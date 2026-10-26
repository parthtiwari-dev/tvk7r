"""Re-pull the January 2026 wind data from Elexon BMRS and rewrite the snapshot in api/data/.

Run from the api/ folder:  python scripts/refresh_data.py

The app only ever reads the snapshot, so it never depends on Elexon being up. The script checks
the data before writing and refuses to overwrite the snapshot if a check fails.
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pandas as pd

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

# Actuals: delivery days 2 Jan to 1 Feb, plus a day either side.
ACTUALS_FROM = "2025-12-31"
ACTUALS_TO = "2026-02-02"

# Forecasts: anything that could forecast an hour from 2 Jan to 1 Feb. Forecasts look up to
# about 66.5 hours ahead, so publishes from 29 Dec are enough. WINDFOR can only be filtered by
# publish time, so it is pulled in 5-day chunks.
FORECASTS_FROM = datetime(2025, 12, 29, tzinfo=timezone.utc)
FORECASTS_TO = datetime(2026, 2, 2, tzinfo=timezone.utc)
CHUNK = timedelta(days=5)

TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def fetch(client, dataset, params):
    response = client.get(f"{BASE_URL}/{dataset}/stream", params=params, timeout=120)
    response.raise_for_status()
    return response.json()


def pull_actuals(client):
    rows = fetch(client, "FUELHH", {
        "settlementDateFrom": ACTUALS_FROM,
        "settlementDateTo": ACTUALS_TO,
        "fuelType": "WIND",
    })
    return pd.DataFrame(rows)[["startTime", "generation"]]


def pull_forecasts(client):
    rows = []
    start = FORECASTS_FROM
    while start < FORECASTS_TO:
        end = min(start + CHUNK, FORECASTS_TO)
        rows += fetch(client, "WINDFOR", {
            "publishDateTimeFrom": start.strftime("%Y-%m-%dT%H:%MZ"),
            "publishDateTimeTo": end.strftime("%Y-%m-%dT%H:%MZ"),
        })
        start = end
    return pd.DataFrame(rows)[["publishTime", "startTime", "generation"]]


def drop_repeats(df, key, name, problems):
    """Drop rows that are exact repeats. Same key with a different value is a problem."""
    df = df.drop_duplicates()
    clashes = df[df.duplicated(key, keep=False)]
    if len(clashes):
        problems.append(f"{name}: {len(clashes)} rows share {key} but differ in value")
    return df


def check_actuals(actuals, problems):
    actuals = drop_repeats(actuals, ["startTime"], "actuals", problems)
    times = pd.to_datetime(actuals["startTime"], utc=True)
    expected = pd.date_range(times.min(), times.max(), freq="30min")
    missing = expected.difference(times)
    if len(missing):
        problems.append(f"actuals: {len(missing)} half-hours missing, first {missing[0]}")
    return actuals


def check_forecasts(forecasts, problems):
    forecasts = drop_repeats(forecasts, ["publishTime", "startTime"], "forecasts", problems)
    starts = pd.to_datetime(forecasts["startTime"], utc=True)
    off_hour = starts[(starts.dt.minute != 0) | (starts.dt.second != 0)]
    if len(off_hour):
        problems.append(f"forecasts: {len(off_hour)} rows not on the hour (engine assumes hourly)")
    return forecasts


def to_csv(df, path, sort_by):
    df = df.copy()
    for column in ("publishTime", "startTime"):
        if column in df:
            df[column] = pd.to_datetime(df[column], utc=True).dt.strftime(TIME_FORMAT)
    df.sort_values(sort_by).to_csv(path, index=False)


def main():
    with httpx.Client() as client:
        actuals = pull_actuals(client)
        forecasts = pull_forecasts(client)

    problems = []
    actuals = check_actuals(actuals, problems)
    forecasts = check_forecasts(forecasts, problems)
    if problems:
        print("Snapshot NOT written:")
        for problem in problems:
            print("  -", problem)
        sys.exit(1)

    DATA_DIR.mkdir(exist_ok=True)
    to_csv(actuals, DATA_DIR / "actuals.csv", ["startTime"])
    to_csv(forecasts, DATA_DIR / "forecasts.csv", ["publishTime", "startTime"])
    meta = {
        "pulled_at": datetime.now(timezone.utc).strftime(TIME_FORMAT),
        "source": BASE_URL,
        "actuals": {
            "dataset": "FUELHH, fuelType=WIND",
            "settlement_dates": [ACTUALS_FROM, ACTUALS_TO],
            "rows": len(actuals),
        },
        "forecasts": {
            "dataset": "WINDFOR",
            "publish_times": [FORECASTS_FROM.strftime(TIME_FORMAT), FORECASTS_TO.strftime(TIME_FORMAT)],
            "rows": len(forecasts),
            "publishes": int(forecasts["publishTime"].nunique()),
        },
    }
    (DATA_DIR / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
