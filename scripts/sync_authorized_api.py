#!/usr/bin/env python3
"""Build the static ranking cache from an authorised, authenticated API.

This deliberately does *not* access results.hyrox.com or any HYROX web page.
It supports the documented independent Hyrox Result API contract, but is guarded by
an explicit confirmation because a technical API login is not, by itself, permission
to redistribute participant data. See README.md before running it.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "athletes.json"
DEPLOY_FILE = ROOT / "docs" / "athletes.json"
META_FILE = ROOT / "data" / "dataset-meta.json"
DEPLOY_META_FILE = ROOT / "docs" / "dataset-meta.json"


class ApiClient:
    def __init__(self, base_url: str, token: str, requests_per_minute: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.minimum_interval = 60 / requests_per_minute
        self.last_request = 0.0

    def get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        elapsed = time.monotonic() - self.last_request
        if elapsed < self.minimum_interval:
            time.sleep(self.minimum_interval - elapsed)
        url = f"{self.base_url}{path}"
        if params:
            url += "?" + urlencode({key: value for key, value in params.items() if value is not None})
        request = Request(url, headers={"Authorization": f"Bearer {self.token}", "Accept": "application/json"})
        try:
            with urlopen(request, timeout=45) as response:
                self.last_request = time.monotonic()
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code == 429:
                retry_after = int(error.headers.get("Retry-After", "60"))
                raise SystemExit(f"API rate limit reached. Retry after {retry_after} seconds.") from error
            raise SystemExit(f"API request failed ({error.code}) for {path}.") from error
        except (URLError, TimeoutError) as error:
            raise SystemExit(f"API request failed for {path}: {error}") from error


def envelope_data(payload: dict[str, Any], path: str) -> Any:
    if payload.get("errors"):
        raise SystemExit(f"API returned an error for {path}: {payload['errors']}")
    if "data" not in payload:
        raise SystemExit(f"Unexpected API response for {path}: missing data.")
    return payload["data"]


def parse_event_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def split_name(display_name: str | None) -> tuple[str, str]:
    parts = (display_name or "Unknown").strip().split()
    if len(parts) < 2:
        return (parts[0] if parts else "Unknown", "Unknown")
    return (" ".join(parts[:-1]), parts[-1])


def cached_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return fallback


def fetch_all_events(client: ApiClient) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    page = 1
    while True:
        payload = client.get("/events", {"per_page": 100, "page": page})
        rows = envelope_data(payload, "/events")
        if not isinstance(rows, list):
            raise SystemExit("Unexpected events response: data is not a list.")
        events.extend(row for row in rows if isinstance(row, dict))
        meta = payload.get("meta") or {}
        if page >= int(meta.get("last_page") or page) or not rows:
            return events
        page += 1


def fetch_event_results(client: ApiClient, event_id: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        payload = client.get(f"/divisions/{event_id}/results", {"limit": 100, "cursor": cursor})
        data = envelope_data(payload, f"/divisions/{event_id}/results")
        if not isinstance(data, list):
            raise SystemExit(f"Unexpected results response for event {event_id}.")
        rows.extend(row for row in data if isinstance(row, dict))
        meta = payload.get("meta") or {}
        if not meta.get("has_more"):
            return rows
        cursor = meta.get("cursor")
        if not cursor:
            raise SystemExit(f"Results pagination for event {event_id} did not provide a cursor.")


def athlete_detail(client: ApiClient, row: dict[str, Any], detail_cache: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    identifier = row.get("athlete_id") or row.get("race_ref")
    if not identifier:
        return None
    identifier = str(identifier)
    if identifier not in detail_cache:
        payload = client.get(f"/athletes/{identifier}")
        data = envelope_data(payload, f"/athletes/{identifier}")
        detail_cache[identifier] = data if isinstance(data, dict) else {}
    return detail_cache[identifier]


def normalized_row(event: dict[str, Any], row: dict[str, Any], detail: dict[str, Any]) -> dict[str, Any] | None:
    milliseconds = detail.get("total_time_ms") or row.get("total_time_ms")
    try:
        seconds = round(int(milliseconds) / 1000)
    except (TypeError, ValueError):
        return None
    if seconds <= 0:
        return None  # excludes DNS/DNF/unusable times
    first_name, last_name = split_name(detail.get("display_name") or row.get("athlete_name"))
    return {
        "race": str(detail.get("race_name") or row.get("event_name") or event.get("name") or "Unknown race"),
        "raceSlug": str(row.get("event_slug") or event.get("slug") or ""),
        "division": str(detail.get("division_name") or row.get("division_name") or "Unknown division"),
        "gender": str(detail.get("sex") or "Unknown"),
        "ageGroup": str(detail.get("age_group") or row.get("age_group") or "Unknown"),
        "nationality": str(detail.get("nationality") or "Unknown"),
        "firstName": first_name,
        "lastName": last_name,
        "seconds": seconds,
        "sourceResultId": str(row.get("id") or row.get("race_ref") or ""),
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh the cached rankings from an authorised API subscription.")
    parser.add_argument("--api-base", default="https://hyroxresultapi.com/api/v1", help="API v1 base URL")
    parser.add_argument("--token", default=os.environ.get("HYROX_RESULTS_API_TOKEN"), help="API bearer token (or HYROX_RESULTS_API_TOKEN)")
    parser.add_argument("--full", action="store_true", help="Backfill every completed event, including those already cached.")
    parser.add_argument("--since", help="Only import events ending on/after YYYY-MM-DD. Defaults to the last sync date.")
    parser.add_argument("--max-events", type=int, help="Safety cap for a test run.")
    parser.add_argument("--requests-per-minute", type=int, default=25, help="Stay below the API plan limit (default: 25).")
    parser.add_argument("--confirm-republication-rights", action="store_true", help="Required acknowledgement that your licence permits public storage and republication.")
    args = parser.parse_args()
    if not args.token:
        raise SystemExit("Missing API token. Set HYROX_RESULTS_API_TOKEN; never put it in docs/ or Git.")
    if not args.confirm_republication_rights:
        raise SystemExit("Refusing to ingest participant data without --confirm-republication-rights. Review the source licence and privacy basis first.")
    if not 1 <= args.requests_per_minute <= 1000:
        raise SystemExit("--requests-per-minute must be between 1 and 1000.")

    metadata = cached_json(META_FILE, {})
    cached_rows = cached_json(DATA_FILE, [])
    if not isinstance(cached_rows, list):
        raise SystemExit(f"{DATA_FILE} must contain a JSON array.")
    cutoff = parse_event_date(args.since) if args.since else (None if args.full else parse_event_date(metadata.get("lastUpdated")))
    client = ApiClient(args.api_base, args.token, args.requests_per_minute)
    events = fetch_all_events(client)
    today = date.today()
    selected = [event for event in events if parse_event_date(event.get("end_date") or event.get("start_date")) and parse_event_date(event.get("end_date") or event.get("start_date")) <= today and (cutoff is None or parse_event_date(event.get("end_date") or event.get("start_date")) >= cutoff)]
    selected.sort(key=lambda event: event.get("end_date") or event.get("start_date") or "")
    if args.max_events is not None:
        selected = selected[:args.max_events]
    print(f"Checking {len(selected)} completed event(s){f' since {cutoff}' if cutoff else ''}.")

    existing = {str(row.get("sourceResultId")): row for row in cached_rows if isinstance(row, dict) and row.get("sourceResultId")}
    detail_cache: dict[str, dict[str, Any]] = {}
    imported = 0
    for index, event in enumerate(selected, start=1):
        event_id = event.get("id")
        if not isinstance(event_id, int):
            print(f"Skipping event without an integer ID: {event.get('name')}")
            continue
        print(f"[{index}/{len(selected)}] {event.get('name', event_id)}")
        for raw in fetch_event_results(client, event_id):
            key = str(raw.get("id") or raw.get("race_ref") or "")
            if key and key in existing and not args.full:
                continue
            detail = athlete_detail(client, raw, detail_cache)
            if not detail:
                continue
            normalized = normalized_row(event, raw, detail)
            if normalized:
                existing[normalized["sourceResultId"]] = normalized
                imported += 1

    if imported == 0 and not args.full:
        print("No new result rows found; cached snapshot was not changed.")
        return

    rows = sorted(existing.values(), key=lambda row: (row["race"], row["division"], row["seconds"], row["lastName"]))
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    next_metadata = {
        "schemaVersion": 1,
        "source": "authorized-api",
        "sourceLabel": "Cached results imported from an authenticated, authorised data source",
        "lastUpdated": now,
        "coverage": f"{len(rows):,} finished result rows across {len({row['raceSlug'] for row in rows})} imported events",
        "privacyNotice": "Publication is subject to the source licence, documented lawful basis, and applicable privacy laws.",
        "ingestedEventSlugs": sorted({row["raceSlug"] for row in rows if row["raceSlug"]}),
    }
    write_json(DATA_FILE, rows); write_json(DEPLOY_FILE, rows); write_json(META_FILE, next_metadata); write_json(DEPLOY_META_FILE, next_metadata)
    print(f"Wrote {len(rows)} cached rows ({imported} new/updated) to data/ and docs/.")


if __name__ == "__main__":
    main()
