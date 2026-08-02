# Race Rank — cached HYROX rankings

A static GitHub Pages site for exploring a locally cached results snapshot. Visitors can filter all-time athlete bests and individual race results by race, division, gender, age group, nationality, and individual/open/pro format. The site never contacts a results provider in a visitor's browser.

## Important: data rights and privacy

This repository does **not** scrape HYROX websites. HYROX's current [Terms of Use](https://hyrox.com/terms-of-use/) prohibit bots, spiders, scrapers, and automated methods that access or republish the site or its data. Do not add a portal scraper here.

The included `athletes.json` is illustrative demo data only; it is not a complete historical ranking and must not be represented as one. Athlete name, nationality, age group, and finish time are personal data when associated with a person. Public visibility of a result is not automatically permission to copy, aggregate, and republish it.

Before production use, obtain all of the following:

- a written HYROX licence/export or a supplier agreement that expressly permits your intended storage and public republication;
- a documented lawful basis and privacy notice appropriate to the countries where you operate (including PDPA/GDPR advice where applicable);
- a contact channel and process for correction, objection, and removal requests;
- a retention/review policy and an attribution/licence record for each imported dataset.

This is practical engineering guidance, not legal advice.

## Data architecture

```
authorised API/export → validation + normalisation → data/athletes.json
                                                  ↘ docs/athletes.json → GitHub Pages
```

`data/` is the reviewed source cache and `docs/` is the deployed mirror. Rankings happen in the browser against that committed cache, so filtering is instant and creates no provider traffic. The importer excludes missing/invalid finish times and the all-time view keeps an athlete's fastest matching result.

## Updating data

### Option A — authorised CSV/JSON export

Use this when HYROX or your data supplier provides a compliant bulk export. It requires exactly these fields (with common snake-case aliases accepted): `race`, `division`, `gender`, `ageGroup`, `nationality`, `firstName`, `lastName`, and `seconds`.

```bash
python3 scripts/refresh_public_results.py authorised-export.csv \
  --source-label "Supplier name — licence reference" \
  --coverage "Completed events through 2026-08-01" \
  --confirm-republication-rights
```

### Option B — authenticated API cache update

The optional `scripts/sync_authorized_api.py` adapter targets the documented [independent Hyrox Result API](https://hyroxresultapi.com/documentation). It is not affiliated with HYROX. Its documentation requires an active subscription/token and it returns event catalogues and paginated results. Confirm the provider's provenance and that its terms give **you** public-republication rights before using it.

```bash
export HYROX_RESULTS_API_TOKEN='your-token' # keep this out of Git
npm run refresh:api -- --full --confirm-republication-rights
```

Use `--full` once for a backfill. Later, run the default command after newly completed races; it checks only events ending since the previous successful sync and does not rewrite the cache if there are no new result rows. Use `--full` again after confirmed source corrections.

GitHub Actions can perform the incremental check every Monday via `.github/workflows/refresh-results.yml`. Add `HYROX_RESULTS_API_TOKEN` at **Repository Settings → Secrets and variables → Actions** first. The workflow is intentionally skipped without that secret. Tokens never enter `docs/` or the website.

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
