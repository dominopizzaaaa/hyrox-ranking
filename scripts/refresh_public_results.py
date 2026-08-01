#!/usr/bin/env python3
"""Normalize a public HYROX race export into the cache schema used by the website.

This script is intentionally manual and conservative. It accepts a public JSON export
from a race results list and normalizes it to a compact ranking-only schema. The
website never calls the official results site on each query; it serves a stored
snapshot and only refreshes the cache when new races are announced/finished.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def normalize_record(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "race": str(item.get("race") or item.get("event") or "Unknown race"),
        "division": str(item.get("division") or item.get("category") or "HYROX"),
        "gender": str(item.get("gender") or "Unknown"),
        "ageGroup": str(item.get("ageGroup") or item.get("age_group") or "All"),
        "nationality": str(item.get("nationality") or item.get("country") or "Unknown"),
        "firstName": str(item.get("firstName") or item.get("first_name") or "Unknown"),
        "lastName": str(item.get("lastName") or item.get("last_name") or "Unknown"),
        "seconds": int(item.get("seconds") or item.get("timeSeconds") or 0),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Path to a public JSON export")
    parser.add_argument("--output", default="docs/athletes.json", help="Where to write normalized data")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    payload = json.loads(input_path.read_text())
    records = payload.get("results") if isinstance(payload, dict) else payload
    if not isinstance(records, list):
        raise SystemExit("Expected a top-level array of records, or an object with a 'results' list.")

    normalized = [normalize_record(item) for item in records if isinstance(item, dict)]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(normalized, indent=2))
    print(f"Wrote {len(normalized)} normalized records to {output_path}")


if __name__ == "__main__":
    main()
