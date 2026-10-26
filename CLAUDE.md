# tvk7r

A web app for a UK energy trading team. It shows the national wind generation forecast that was
available at the time a day-ahead purchase decision had to be made, and measures how accurate
those forecasts were. Data: Elexon BMRS (FUELHH for actuals, WINDFOR for forecasts), January 2026
decisions only.

## Stack

- Front end: React (Vite) + TypeScript + Observable Plot, in `web/`
  - `api.ts` types and fetches, `format.ts` UK time and MW, `story.ts` screen helpers,
    `components/` the screen. Run from `web/`: `npm test`, `npm run dev` (forwards `/api` to 8000)
- Back end: Python, FastAPI, pandas, in `api/`
  - `engine/` pure logic (no web code, no file reading), `app.py` the endpoints,
    `snapshot.py` reads `data/`, `scripts/refresh_data.py` re-pulls the data, `tests/` pytest
  - Run tests from `api/`: `python -m pytest`. Run the API: `uvicorn app:app --reload`
- Docker: `docker compose up --build` runs both (API + nginx serving the built app) on port 8080
- CI: `.github/workflows/ci.yml` runs pytest, web lint/tests/build, and a Docker smoke test
- Vercel: `vercel.json` builds `web/`, serves `web/dist`, sends `/api/*` to `api/app.py` (one
  function, `api/data/**` bundled). `api/.python-version` pins Python 3.13. Pushes to `main`
  deploy to https://tvk7r.vercel.app

## Rules

- No lookahead: a forecast counts for a decision only if its `publishTime` is strictly before the
  cutoff. "What you'd have known that morning" numbers use only delivery days already over.
- Error = forecast minus actual (positive = wind came in short). Cover is sized from the short
  side.
- The core selection and metrics logic is pure functions with tests.
- Times are stored in UTC and shown in UK time.
- The README must stay true: never describe a feature the code doesn't have.
