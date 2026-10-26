# tvk7r

A web app for a UK energy trading team. It shows the national wind generation forecast that was
available at the time a day-ahead purchase decision had to be made, and measures how accurate
those forecasts were. Data: Elexon BMRS (FUELHH for actuals, WINDFOR for forecasts), January 2026
decisions only.

## Stack

- Front end: React (Vite), in `web/` (not built yet)
- Back end: Python, FastAPI, in `api/` (not built yet)
- Docker for local runs, Vercel for deploy

## Rules

- No lookahead: a forecast counts for a decision only if its `publishTime` is before the cutoff.
- The core selection and metrics logic is pure functions with tests.
- Times are stored in UTC and shown in UK time.
- The README must stay true: never describe a feature the code doesn't have.
