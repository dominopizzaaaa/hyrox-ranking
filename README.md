# HYROX Ranking

A lightweight public-results ranking demo for HYROX race data.

## Data source and privacy posture

This repository intentionally uses only publicly surfaced results fields from the official HYROX results portal, then stores a compact ranking-only dataset:

- first name
- last name
- nationality
- age group
- gender
- race name
- division
- best time

It does not store private account data, DOB, address, contact details, or any profile metadata beyond what is shown in a public competition result list.

## How the data is refreshed

- The project keeps a cached, public ranking dataset in `data/athletes.json`.
- When a new race is complete, a maintainer can generate a fresh export from the official results portal and replace the JSON snapshot.
- The website reads the cached dataset from GitHub Pages and only recalculates rankings locally in the browser.

## Local preview

```bash
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000`.

## Deployment

A GitHub Pages workflow is prepared in `.github/workflows/deploy-pages.yml`.

## Notes

No private auth or personal profile endpoint is required for this project. All scoring and ranking is derived from publicly viewable race fields.
