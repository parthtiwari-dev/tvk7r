# tvk7r

A web app for a UK energy trading team. It shows the national wind generation forecast that was
available at the time a day-ahead purchase decision had to be made, and measures how accurate
those forecasts were. Data: Elexon BMRS (FUELHH for actuals, WINDFOR for forecasts), January 2026
decisions only.

## Stack

- Front end: React (Vite), in `web/` (not built yet)
- Back end: Python, FastAPI, pandas, in `api/`
  - `engine/` pure logic (no web code, no file reading), `app.py` the endpoints,
    `snapshot.py` reads `data/`, `scripts/refresh_data.py` re-pulls the data, `tests/` pytest
  - Run tests from `api/`: `python -m pytest`. Run the API: `uvicorn app:app --reload`
- Docker for local runs, Vercel for deploy (not set up yet)

## Rules

- No lookahead: a forecast counts for a decision only if its `publishTime` is strictly before the
  cutoff. "What you'd have known that morning" numbers use only delivery days already over.
- Error = forecast minus actual (positive = wind came in short). Cover is sized from the short
  side.
- The core selection and metrics logic is pure functions with tests.
- Times are stored in UTC and shown in UK time.
- The README must stay true: never describe a feature the code doesn't have.
