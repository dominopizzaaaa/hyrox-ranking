#!/usr/bin/env python3
"""Convert the checked-in results cache to deterministic gzip files for GitHub Pages."""

from __future__ import annotations

import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "athletes.json"
TARGETS = [ROOT / "data" / "athletes.json.gz", ROOT / "docs" / "athletes.json.gz"]


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing source cache: {SOURCE}")
    rows = json.loads(SOURCE.read_text())
    if not isinstance(rows, list) or not rows:
        raise SystemExit("Source cache must be a non-empty JSON array.")
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    for target in TARGETS:
        with gzip.GzipFile(filename=str(target), mode="wb", compresslevel=9, mtime=0) as destination:
            destination.write(payload)
    print(f"Compressed {len(rows):,} rows to {TARGETS[0].name} and {TARGETS[1].name}.")


if __name__ == "__main__":
    main()
