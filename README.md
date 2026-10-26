# tvk7r

UK wind forecast monitor: the forecast you had when you had to decide, and how far off it was.

Work in progress. The back end (data snapshot, engine, API) is built; the front end is not yet.

## Back end (so far)

From the `api/` folder, with Python 3.13:

```
pip install -r requirements-dev.txt
python -m pytest              # run the tests
uvicorn app:app --reload      # start the API on http://127.0.0.1:8000 (docs at /docs)
python scripts/refresh_data.py  # re-pull the data snapshot from Elexon
```
