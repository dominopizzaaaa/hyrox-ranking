#!/usr/bin/env python3
"""Validate and publish a manually supplied, authorised results export.

This is for an export you are entitled to store and publish. It deliberately does
not fetch HYROX pages or call an unauthorised endpoint. The output is mirrored into
docs/ because GitHub Pages serves that directory.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = ("race", "division", "gender", "ageGroup", "nationality", "firstName", "lastName", "seconds")


def read_input(path: Path) -> list[dict[str, Any]]:
    if path.suffix.lower() == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as file:
            return list(csv.DictReader(file))
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload.get("results") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise SystemExit("Expected a JSON array, an object with a 'results' array, or CSV with the required headers.")
    return [row for row in rows if isinstance(row, dict)]


def normalise(record: dict[str, Any], index: int) -> dict[str, Any]:
    aliases = {"ageGroup": ("ageGroup", "age_group"), "firstName": ("firstName", "first_name"), "lastName": ("lastName", "last_name"), "nationality": ("nationality", "country"), "seconds": ("seconds", "timeSeconds", "time_seconds")}
    value = lambda key: next((record.get(candidate) for candidate in aliases.get(key, (key,)) if record.get(candidate) not in (None, "")), record.get(key))
    row = {key: value(key) for key in REQUIRED}
    missing = [key for key, item in row.items() if item in (None, "")]
    if missing:
        raise SystemExit(f"Record {index} is missing: {', '.join(missing)}")
    try:
        row["seconds"] = int(float(str(row["seconds"])))
    except ValueError as error:
        raise SystemExit(f"Record {index} has an invalid seconds value.") from error
    if row["seconds"] <= 0:
        raise SystemExit(f"Record {index} has a non-finish/invalid time.")
    return {key: str(item).strip() if key != "seconds" else item for key, item in row.items()}


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def write_records(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with gzip.GzipFile(filename=str(path), mode="wb", compresslevel=9, mtime=0) as destination:
        destination.write(payload)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Authorised JSON or CSV export")
    parser.add_argument("--source-label", required=True, help="Human-readable source/licence reference to display in site metadata")
    parser.add_argument("--coverage", required=True, help="Coverage statement, e.g. 'Season 8 completed events through 2026-08-01'")
    parser.add_argument("--confirm-republication-rights", action="store_true", help="Required acknowledgement that the source permits public republication")
    args = parser.parse_args()
    if not args.confirm_republication_rights:
        raise SystemExit("Refusing to publish participant data without --confirm-republication-rights.")
    rows = [normalise(row, index) for index, row in enumerate(read_input(Path(args.input)), start=1)]
    rows.sort(key=lambda row: (row["race"], row["division"], row["seconds"], row["lastName"]))
    metadata = {"schemaVersion": 1, "source": "authorised-export", "sourceLabel": args.source_label, "lastUpdated": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"), "coverage": args.coverage, "privacyNotice": "Publication is subject to the source licence, documented lawful basis, and applicable privacy laws.", "ingestedEventSlugs": []}
    for relative in ("data/athletes.json.gz", "docs/athletes.json.gz"):
        write_records(ROOT / relative, rows)
    for relative in ("data/dataset-meta.json", "docs/dataset-meta.json"):
        write_json(ROOT / relative, metadata)
    print(f"Published {len(rows)} validated result rows to the cached dataset.")


if __name__ == "__main__":
    main()
