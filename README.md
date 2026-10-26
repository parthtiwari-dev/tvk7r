# tvk7r

UK wind forecast monitor: the forecast you had when you had to decide, and how far off it was.

Work in progress. The back end (data snapshot, engine, API) and the front end (one-screen React
app) are built; Docker, deploy and the full README come next.

## Back end

From the `api/` folder, with Python 3.13:

```
pip install -r requirements-dev.txt
python -m pytest              # run the tests
uvicorn app:app --reload      # start the API on http://127.0.0.1:8000 (docs at /docs)
python scripts/refresh_data.py  # re-pull the data snapshot from Elexon
```

## Front end

From the `web/` folder, with Node 20 or later, while the API runs on port 8000:

```
npm install
npm test          # run the tests
npm run dev       # start the app on http://localhost:5173 (it forwards /api to port 8000)
```
