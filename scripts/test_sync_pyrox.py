#!/usr/bin/env python3
"""Small contract tests for the pyrox-to-static-cache normalisation layer."""

import unittest

import pandas as pd

from sync_pyrox import normalise_frame, result_seconds, skipped_event


class SyncPyroxTests(unittest.TestCase):
    def test_normalises_minutes_and_preserves_event_identity(self):
        frame = pd.DataFrame([{
            "name": "Sato, Ren",
            "event_name": "HYROX Singapore 2026",
            "event_id": "singapore-2026",
            "athlete_id": "athlete-42",
            "result_id": "result-42",
            "division": "HYROX PRO",
            "gender": "Men",
            "age_group": "25-29",
            "nationality": "Singapore",
            "total_time": 61.5,
        }])

        result = normalise_frame(frame, {"location": "Singapore", "year": 2026}, "8:singapore:2026")

        self.assertEqual(result, [{
            "race": "HYROX Singapore 2026",
            "raceSlug": "singapore-2026",
            "division": "HYROX PRO",
            "gender": "Men",
            "ageGroup": "25-29",
            "nationality": "Singapore",
            "firstName": "Ren",
            "lastName": "Sato",
            "seconds": 3690,
            "sourceResultId": "result-42",
            "sourceEventKey": "8:singapore:2026",
            "sourceAthleteId": "athlete-42",
        }])

    def test_rejects_invalid_or_missing_times(self):
        self.assertIsNone(result_seconds(pd.Series({"total_time": None})))
        self.assertIsNone(result_seconds(pd.Series({"total_time": "not a time"})))
        self.assertIsNone(result_seconds(pd.Series({"total_time": 0})))

    def test_derived_result_id_is_stable_when_source_id_is_unavailable(self):
        frame = pd.DataFrame([{
            "name": "Ava Tan",
            "division": "HYROX",
            "gender": "Women",
            "age_group": "30-34",
            "nationality": "Singapore",
            "total_time": 70,
        }])

        first = normalise_frame(frame, {"location": "Singapore", "year": 2026}, "8:singapore:2026")[0]
        second = normalise_frame(frame, {"location": "Singapore", "year": 2026}, "8:singapore:2026")[0]

        self.assertTrue(first["sourceResultId"].startswith("derived:"))
        self.assertEqual(first["sourceResultId"], second["sourceResultId"])

    def test_skipped_event_keeps_a_retryable_manifest_identity(self):
        event = skipped_event(
            "6:los-angeles:2023",
            {"file_last_modified": "2026-08-02T00:00:00Z"},
            ValueError("Expecting value: line 1 column 1 (char 0)"),
        )

        self.assertEqual(event["eventKey"], "6:los-angeles:2023")
        self.assertEqual(event["fileLastModified"], "2026-08-02T00:00:00Z")
        self.assertIn("ValueError", event["error"])


if __name__ == "__main__":
    unittest.main()
