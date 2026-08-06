#!/usr/bin/env python3
"""Clean and normalise the existing cached results.

This rebuilds data/athletes.json.gz and docs/athletes.json.gz (plus metadata)
from the already imported pyrox cache. It removes obviously invalid rows
(placeholder "Test" entries and physically impossible finish times), normalises
duplicated doubles nationalities, derives a clean year/city for each event, and
tags every row with a canonical category so the browser can filter reliably.
"""
from __future__ import annotations

import gzip
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "athletes.json.gz"
DEPLOY_FILE = ROOT / "docs" / "athletes.json.gz"
META_FILE = ROOT / "data" / "dataset-meta.json"
DEPLOY_META_FILE = ROOT / "docs" / "dataset-meta.json"

# HYROX world-record singles are ~52 min; anything under 40 min (2400 s) for a
# full race is a data artefact. The slowest legitimate finishes run past 3 h.
MIN_SECONDS = 2400
MAX_SECONDS = 5 * 3600

# Canonical division -> (competition type, tier)
DIVISION_MAP = {
    "open": ("Individual", "Open"),
    "pro": ("Individual", "Pro"),
    "doubles": ("Doubles", "Open"),
    "pro_doubles": ("Doubles", "Pro"),
    "relay": ("Relay", "Open"),
    "adaptive": ("Adaptive", "Open"),
}


def read_records() -> list[dict[str, Any]]:
    with gzip.open(DATA_FILE, "rt", encoding="utf-8") as source:
        return json.load(source)


def write_records(records: list[dict[str, Any]]) -> None:
    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    for path in (DATA_FILE, DEPLOY_FILE):
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.GzipFile(filename=str(path), mode="wb", compresslevel=9, mtime=0) as dest:
            dest.write(payload)


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def clean_name(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def is_placeholder(*names: str) -> bool:
    joined = " ".join(names).lower().strip()
    if not joined:
        return True
    tokens = [t for t in re.split(r"[\s,]+", joined) if t]
    junk = {"test", "tester", "testing", "unknown", "n/a", "na", "tbd", "xxx", "-"}
    return all(t in junk for t in tokens)


def dedupe_nationality(value: str) -> str:
    parts = [p.strip() for p in (value or "").split(",") if p.strip()]
    if not parts:
        return "Unknown"
    seen: list[str] = []
    for p in parts:
        if p not in seen:
            seen.append(p)
    # A doubles team from one country collapses to a single code.
    return ", ".join(seen)


YEAR_RE = re.compile(r"(19|20)\d{2}")


def parse_race(race: str) -> tuple[str, str | None]:
    """Return (city, year) from a race label like '2026 Berlin' or 'S1 2018 Leipzig'."""
    label = clean_name(race)
    year = None
    match = YEAR_RE.search(label)
    if match:
        year = match.group(0)
    city = YEAR_RE.sub("", label)
    city = re.sub(r"\bS\d+\b", "", city, flags=re.IGNORECASE)
    city = clean_name(city) or label
    return city, year


def main() -> None:
    source = read_records()
    print(f"Loaded {len(source):,} raw rows.")

    cleaned: list[dict[str, Any]] = []
    dropped_time = dropped_name = dropped_div = 0
    for row in source:
        seconds = row.get("seconds")
        if not isinstance(seconds, int) or seconds < MIN_SECONDS or seconds > MAX_SECONDS:
            dropped_time += 1
            continue
        first = clean_name(row.get("firstName", ""))
        last = clean_name(row.get("lastName", ""))
        if is_placeholder(first, last):
            dropped_name += 1
            continue
        division = str(row.get("division", "")).lower()
        if division not in DIVISION_MAP:
            dropped_div += 1
            continue
        comp_type, tier = DIVISION_MAP[division]
        city, year = parse_race(row.get("race", ""))
        cleaned.append({
            "race": clean_name(row.get("race", "")) or "Unknown event",
            "city": city,
            "year": year or "",
            "compType": comp_type,
            "tier": tier,
            "gender": str(row.get("gender", "")).lower() or "unknown",
            "ageGroup": clean_name(row.get("ageGroup", "")) or "Unknown",
            "nationality": dedupe_nationality(row.get("nationality", "")),
            "firstName": first or "Unknown",
            "lastName": last or "Unknown",
            "seconds": seconds,
            "sourceEventKey": row.get("sourceEventKey", ""),
            "sourceResultId": row.get("sourceResultId", ""),
            "sourceAthleteId": row.get("sourceAthleteId", ""),
        })

    print(f"Dropped {dropped_time:,} bad times, {dropped_name:,} placeholder names, {dropped_div:,} unknown divisions.")
    cleaned.sort(key=lambda r: (r["seconds"], r["race"]))
    print(f"Kept {len(cleaned):,} clean rows.")

    years = sorted({r["year"] for r in cleaned if r["year"]})
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    metadata = {
        "schemaVersion": 2,
        "source": "pyrox-client",
        "sourceLabel": "HYROX race results via pyrox-client (unofficial HYROX API)",
        "lastUpdated": now,
        "coverage": (
            f"{len(cleaned):,} verified finishes across "
            f"{len({r['race'] for r in cleaned}):,} events"
            + (f", {years[0]}\u2013{years[-1]}" if years else "")
        ),
        "totalResults": len(cleaned),
        "totalEvents": len({r["race"] for r in cleaned}),
        "years": years,
        "privacyNotice": "Results sourced from the independently maintained pyrox-client dataset. Not affiliated with HYROX.",
    }
    write_records(cleaned)
    write_json(META_FILE, metadata)
    write_json(DEPLOY_META_FILE, metadata)
    print("Wrote cleaned cache and metadata.")


if __name__ == "__main__":
    main()
