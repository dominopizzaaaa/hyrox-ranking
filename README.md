# Race Rank — cached HYROX rankings

A static GitHub Pages site for exploring a locally cached results snapshot. Visitors can filter all-time athlete bests and individual race results by race, division, gender, age group, nationality, competition type, and Open/Pro tier. The site never contacts a results provider in a visitor's browser.

## Important: data rights and privacy

This repository does **not** scrape HYROX websites. It uses the independently maintained `pyrox-client` package and its published CDN dataset as an optional import source; it is not affiliated with HYROX. Before putting imported results on a public website, confirm that your data-source licence and the applicable privacy rules permit storage and republication.

The included `athletes.json` is illustrative demo data only; it is not a complete historical ranking and must not be represented as one. Athlete name, nationality, age group, and finish time are personal data when associated with a person. Public visibility of a result is not automatically permission to copy, aggregate, and republish it.

Before production use, obtain all of the following:

- a written HYROX licence/export or a supplier agreement that expressly permits your intended storage and public republication;
- a documented lawful basis and privacy notice appropriate to the countries where you operate (including PDPA/GDPR advice where applicable);
- a contact channel and process for correction, objection, and removal requests;
- a retention/review policy and an attribution/licence record for each imported dataset.

This is practical engineering guidance, not legal advice.

## Data architecture

```
authorised API/export → validation + normalisation → data/athletes.json.gz
                                                  ↘ docs/athletes.json.gz → GitHub Pages
```

`data/` is the reviewed source cache and `docs/` is the deployed mirror. The result cache is gzip-compressed before commit so the full snapshot stays below GitHub's file-size limit; the browser decompresses it locally before filtering. Rankings happen in the browser against that committed cache, so filtering is instant and creates no provider traffic. The importer excludes missing/invalid finish times and the all-time view keeps an athlete's fastest matching result.

## Updating data

### Option A — authorised CSV/JSON export

Use this when HYROX or your data supplier provides a compliant bulk export. It requires exactly these fields (with common snake-case aliases accepted): `race`, `division`, `gender`, `ageGroup`, `nationality`, `firstName`, `lastName`, and `seconds`.

```bash
python3 scripts/refresh_public_results.py authorised-export.csv \
  --source-label "Supplier name — licence reference" \
  --coverage "Completed events through 2026-08-01" \
  --confirm-republication-rights
```

### Option B — pyrox-client cache update

`scripts/sync_pyrox.py` downloads the version-pinned `pyrox-client` manifest and result files into the checked-in static cache. The first import must be a full backfill; later imports replace only result files whose manifest timestamp changed. The script requires an explicit confirmation before it writes public data.

```bash
python3 -m pip install -r requirements.txt

# Inspect a small sample first. This never changes data/ or docs/.
npm run refresh:pyrox -- --dry-run --max-events 1

# After confirming your republication rights, create the public cache.
npm run refresh:pyrox -- --full --confirm-republication-rights

# Later, import only changed source event files.
npm run refresh:pyrox -- --confirm-republication-rights
```

Use `--full` once for a backfill and again after a schema change or confirmed source correction. `--max-events` is intentionally limited to dry runs so a partial test cannot replace the public cache. The importer excludes missing or invalid finish times, gives each imported result a stable event key, and replaces all rows from an updated event together.

If a single published source file is malformed or temporarily unavailable, the importer logs it as skipped, publishes the successful event files, and retries that event on the next incremental run. Add `--strict` only when you want any failed event to stop the import.

GitHub Actions can perform the incremental check every Monday via `.github/workflows/refresh-results.yml`, but it is intentionally disabled until you set repository variable `ENABLE_PYROX_SYNC` to `true`. That is a deliberate public-republication safeguard, not a technical requirement.

## Local preview and checks

```bash
npm test
npm run validate-data
npm run serve
```

Open <http://localhost:8000>. `npm test` checks JavaScript and Python syntax; `validate-data` ensures the source and deployed cache are identical and contain all required fields.

## Deploying

Pushing to `main` runs `.github/workflows/deploy-pages.yml`. It publishes `docs/` with GitHub Pages. In the repository, ensure **Settings → Pages → Source** is set to **GitHub Actions**. The expected public URL is:

`https://dominopizzaaaa.github.io/hyrox-ranking/`

The scheduled cache-refresh workflow deploys the same Pages artifact after it has committed a data update.
