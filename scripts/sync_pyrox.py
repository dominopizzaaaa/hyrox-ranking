#!/usr/bin/env python3
"""Build the cached rankings dataset from pyrox-client's public race manifest.

The provider is intentionally pinned in requirements.txt. This script queries each
manifest entry (season + location + year), stores one compact result cache in the
repository, and never exposes a source request to a website visitor.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import pandas as pd
    import pyrox
except ImportError as error:
    raise SystemExit("Install the pinned provider first: python3 -m pip install -r requirements.txt") from error

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "athletes.json.gz"
DEPLOY_FILE = ROOT / "docs" / "athletes.json.gz"
LEGACY_DATA_FILE = ROOT / "data" / "athletes.json"
META_FILE = ROOT / "data" / "dataset-meta.json"
DEPLOY_META_FILE = ROOT / "docs" / "dataset-meta.json"


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return fallback


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def read_records() -> list[dict[str, Any]]:
    """Read the compressed cache, with a temporary fallback for migration."""
    if DATA_FILE.exists():
        with gzip.open(DATA_FILE, "rt", encoding="utf-8") as source:
            payload = json.load(source)
    else:
        payload = read_json(LEGACY_DATA_FILE, [])
    if not isinstance(payload, list):
        raise SystemExit(f"{DATA_FILE} must contain a JSON array.")
    return payload


def write_records(records: list[dict[str, Any]]) -> None:
    """Write identical gzip-compressed data for review and GitHub Pages."""
    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    for path in (DATA_FILE, DEPLOY_FILE):
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.GzipFile(filename=str(path), mode="wb", compresslevel=9, mtime=0) as destination:
            destination.write(payload)


def value(row: Any, *names: str, fallback: str = "Unknown") -> str:
    for name in names:
        item = row.get(name) if hasattr(row, "get") else None
        if item is not None and not pd.isna(item) and str(item).strip():
            return str(item).strip()
    return fallback


def split_name(name: str) -> tuple[str, str]:
    if "," in name:
        last, first = (part.strip() for part in name.split(",", 1))
        return (first or "Unknown", last or "Unknown")
    parts = name.split()
    if len(parts) < 2:
        return (parts[0] if parts else "Unknown", "Unknown")
    return (" ".join(parts[:-1]), parts[-1])


def result_seconds(row: Any) -> int | None:
    """Return a whole number of seconds from pyrox's minutes-based time column."""
    minutes = row.get("total_time") if hasattr(row, "get") else None
    if minutes is None or pd.isna(minutes):
        minutes = row.get("total_time_min") if hasattr(row, "get") else None
    try:
        seconds = round(float(minutes) * 60)
    except (TypeError, ValueError):
        return None
    return seconds if seconds > 0 else None


def stable_result_id(row: Any, event_key: str) -> str:
    """Prefer the provider's result id; fall back to a deterministic row fingerprint."""
    supplied = value(row, "result_id", "source_result_id", "id", "race_ref", fallback="")
    if supplied:
        return supplied
    fingerprint = "|".join([
        event_key,
        value(row, "name", "athlete_name", fallback=""),
        value(row, "division", fallback=""),
        value(row, "gender", fallback=""),
        value(row, "age_group", "ageGroup", fallback=""),
        value(row, "nationality", fallback=""),
        str(row.get("total_time", row.get("total_time_min", ""))),
    ])
    return f"derived:{hashlib.sha256(fingerprint.encode()).hexdigest()[:24]}"


def normalise_frame(frame: pd.DataFrame, manifest_row: Any, source_event_key: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    default_race = f"HYROX {value(manifest_row, 'location')} {value(manifest_row, 'year')}"
    for _, row in frame.iterrows():
        seconds = result_seconds(row)
        if seconds is None:
            continue
        first_name, last_name = split_name(value(row, "name"))
        event_id = value(row, "event_id", "event_slug", fallback=value(manifest_row, "race_id", fallback=source_event_key))
        records.append({
            "race": value(row, "event_name", fallback=default_race),
            "raceSlug": event_id,
            "division": value(row, "division"),
            "gender": value(row, "gender"),
            "ageGroup": value(row, "age_group"),
            "nationality": value(row, "nationality"),
            "firstName": first_name,
            "lastName": last_name,
            "seconds": seconds,
            "sourceResultId": stable_result_id(row, source_event_key),
            "sourceEventKey": source_event_key,
            "sourceAthleteId": value(row, "athlete_id", "athleteId", fallback=""),
        })
    return records


def download_event(manifest_row: Any, cache_dir: Path | None) -> list[dict[str, Any]]:
    client = pyrox.PyroxClient(cache_dir=cache_dir)
    frame = client.get_race(
        season=int(manifest_row["season"]),
        location=str(manifest_row["location"]),
        year=int(manifest_row["year"]),
        use_cache=True,
    )
    return normalise_frame(frame, manifest_row, event_key(manifest_row))


def event_key(manifest_row: Any) -> str:
    return f"{manifest_row['season']}:{manifest_row['location']}:{manifest_row['year']}"


def skipped_event(key: str, manifest_row: Any, error: Exception) -> dict[str, str]:
    """Keep enough detail to retry a transiently unreadable event on the next run."""
    return {
        "eventKey": key,
        "fileLastModified": str(manifest_row.get("file_last_modified", "")),
        "error": f"{type(error).__name__}: {error}",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh cached HYROX rankings through pyrox-client.")
    parser.add_argument("--full", action="store_true", help="Rebuild the complete pyrox manifest instead of only changed events.")
    parser.add_argument("--max-events", type=int, help="Safety cap for testing.")
    parser.add_argument("--workers", type=int, default=6, help="Concurrent race-file downloads (default: 6).")
    parser.add_argument("--cache-dir", type=Path, help="Optional local pyrox cache directory.")
    parser.add_argument("--dry-run", action="store_true", help="Download and validate selected events without changing the published cache.")
    parser.add_argument("--confirm-republication-rights", action="store_true", help="Required before writing results that will be publicly deployed.")
    parser.add_argument("--strict", action="store_true", help="Abort if any event cannot be read instead of publishing the successful events.")
    args = parser.parse_args()
    if not 1 <= args.workers <= 16:
        raise SystemExit("--workers must be between 1 and 16.")
    if args.max_events is not None and args.max_events < 1:
        raise SystemExit("--max-events must be at least 1.")
    if args.max_events is not None and not args.dry_run:
        raise SystemExit("--max-events is only supported with --dry-run, so a partial download cannot overwrite the public cache.")
    if not args.dry_run and not args.confirm_republication_rights:
        raise SystemExit("Refusing to publish participant data without --confirm-republication-rights. Review your source licence and privacy basis first.")

    client = pyrox.PyroxClient(cache_dir=args.cache_dir)
    # pyrox-client 0.2.5 publishes a versioned manifest but no public manifest
    # method; pinning the package makes this small internal access deterministic.
    manifest = client._get_manifest(force_refresh=True)
    required = {"season", "location", "year", "file_last_modified"}
    if not required.issubset(manifest.columns):
        raise SystemExit(f"Unexpected pyrox manifest columns: {', '.join(manifest.columns)}")
    manifest = manifest.sort_values(["season", "location", "year"]).reset_index(drop=True)
    metadata = read_json(META_FILE, {})
    previous_marker = metadata.get("pyroxManifestLastModified")
    if args.full or metadata.get("source") != "pyrox-client" or not previous_marker:
        selected = manifest
    else:
        existing = read_records()
        if any(isinstance(record, dict) and not record.get("sourceEventKey") for record in existing):
            raise SystemExit("Existing pyrox cache has no sourceEventKey values. Run once with --full to migrate it safely.")
        retry_keys = {
            str(item.get("eventKey"))
            for item in metadata.get("pyroxSkippedEvents", [])
            if isinstance(item, dict) and item.get("eventKey")
        }
        changed_mask = manifest["file_last_modified"].astype(str) > str(previous_marker)
        retry_mask = manifest.apply(lambda row: event_key(row) in retry_keys, axis=1)
        selected = manifest[changed_mask | retry_mask]
    if args.max_events is not None:
        selected = selected.head(args.max_events)
    if selected.empty:
        print("No changed pyrox event files; cached snapshot was not changed.")
        return
    print(f"Downloading {len(selected)} pyrox event file(s) with {args.workers} worker(s).")

    records_by_event: dict[str, list[dict[str, Any]]] = {}
    failed_events: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(download_event, row, args.cache_dir): (event_key(row), row)
            for _, row in selected.iterrows()
        }
        for index, future in enumerate(as_completed(futures), start=1):
            key, manifest_row = futures[future]
            try:
                records_by_event[key] = future.result()
                print(f"[{index}/{len(futures)}] {key}: {len(records_by_event[key])} finishers")
            except Exception as error:
                failed_events.append(skipped_event(key, manifest_row, error))
                print(f"[{index}/{len(futures)}] {key}: skipped ({error})", file=sys.stderr)

    if failed_events and args.strict:
        keys = ", ".join(event["eventKey"] for event in failed_events)
        raise SystemExit(f"Failed to load {len(failed_events)} event file(s) in --strict mode: {keys}")

    downloaded = sum(len(rows) for rows in records_by_event.values())
    if args.dry_run:
        print(f"Dry run complete: {downloaded:,} valid finishers across {len(records_by_event):,} event file(s); {len(failed_events)} skipped.")
        return

    if args.full or metadata.get("source") != "pyrox-client":
        combined = records_by_event
    else:
        existing = read_records()
        selected_keys = set(records_by_event)
        combined: dict[str, list[dict[str, Any]]] = {}
        for record in existing:
            if not isinstance(record, dict):
                continue
            key = str(record.get("sourceEventKey") or "")
            if key and key not in selected_keys:
                combined.setdefault(key, []).append(record)
        combined.update(records_by_event)

    deduped: dict[tuple[str, str], dict[str, Any]] = {}
    for event_records in combined.values():
        for record in event_records:
            identity = (record["sourceEventKey"], record["sourceResultId"])
            deduped[identity] = record
    records = sorted(deduped.values(), key=lambda row: (row["race"], row["division"], row["seconds"], row["lastName"], row["firstName"]))
    if not records:
        raise SystemExit("The provider returned no valid finishers; existing cache was left untouched.")
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    metadata = {
        "schemaVersion": 1,
        "source": "pyrox-client",
        "sourceLabel": "Cached race results imported with pyrox-client 0.2.5",
        "lastUpdated": now,
        "coverage": f"{len(records):,} finished result rows from {len(combined):,} imported race files (seasons {manifest['season'].min()}–{manifest['season'].max()})",
        "privacyNotice": "This independently sourced cache is published only after the maintainer has confirmed that its source licence and privacy basis allow republication.",
        "pyroxManifestLastModified": str(manifest["file_last_modified"].max()),
        "pyroxSkippedEvents": sorted(failed_events, key=lambda event: event["eventKey"]),
        "ingestedEventSlugs": sorted({record["raceSlug"] for record in records if record["raceSlug"]}),
    }
    write_records(records); write_json(META_FILE, metadata); write_json(DEPLOY_META_FILE, metadata)
    print(f"Published {len(records):,} cached finishers to data/ and docs/; {len(failed_events)} event file(s) skipped.")


if __name__ == "__main__":
    main()
