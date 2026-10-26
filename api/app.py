"""The web API. Loads the snapshot once, asks the engine, returns JSON.

Times in responses are UTC (ISO 8601, ending in Z); the front end shows them in UK time.
MW and percentages are rounded to one decimal place.
"""

import math
import re
from datetime import date, time, timedelta
from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, HTTPException

from engine import accuracy
from engine.forecast import cutoff_utc, decisions, delivery_hours, hourly_actuals, uk_midnight
from snapshot import load_snapshot

# Decisions made 1 to 31 Jan 2026, so delivery days 2 Jan to 1 Feb 2026.
FIRST_DELIVERY_DAY = date(2026, 1, 2)
LAST_DELIVERY_DAY = date(2026, 2, 1)
DELIVERY_DAYS = [FIRST_DELIVERY_DAY + timedelta(days=i) for i in range((LAST_DELIVERY_DAY - FIRST_DELIVERY_DAY).days + 1)]
DEFAULT_CUTOFF = "09:20"  # EPEX day-ahead auction gate closure, UK time

ACTUALS, FORECASTS, META = load_snapshot()
HOURLY = hourly_actuals(ACTUALS)

app = FastAPI(title="tvk7r", description="The wind forecast you had at the cutoff, and how far off it was.")


# ---- input checks ---------------------------------------------------------------------------

def parse_cutoff(text):
    if not re.fullmatch(r"\d{2}:\d{2}", text):
        raise HTTPException(400, "cutoff must be a UK time as HH:MM, for example 09:20")
    try:
        return time.fromisoformat(text)
    except ValueError:
        raise HTTPException(400, "cutoff must be a UK time as HH:MM, for example 09:20")


def parse_delivery_day(text):
    try:
        day = date.fromisoformat(text)
    except ValueError:
        raise HTTPException(400, "delivery day must be a date as YYYY-MM-DD, for example 2026-01-15")
    if not FIRST_DELIVERY_DAY <= day <= LAST_DELIVERY_DAY:
        raise HTTPException(400, "delivery day must be between 2026-01-02 and 2026-02-01")
    return day


# ---- formatting -----------------------------------------------------------------------------

def to_json(value):
    """Round floats, turn missing values into null, and dates and times into ISO strings."""
    if isinstance(value, dict):
        return {k: to_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [to_json(v) for v in value]
    if value is None or value is pd.NaT:
        return None
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(value, date):
        return value.isoformat()
    if hasattr(value, "item"):  # numpy number
        value = value.item()
    if isinstance(value, float):
        return None if math.isnan(value) else round(value, 1)
    return value


def day_label(day):
    return f"{day:%a} {day.day} {day:%b}"


def describe_day(day):
    decision_day = day - timedelta(days=1)
    return {
        "delivery_day": day,
        "decision_day": decision_day,
        "label": f"Decide {day_label(decision_day)}, delivery {day_label(day)}",
    }


# ---- engine calls, cached per cutoff --------------------------------------------------------

@lru_cache(maxsize=32)
def decision_table(cutoff):
    return decisions(FORECASTS, HOURLY, DELIVERY_DAYS, cutoff)


@lru_cache(maxsize=1)
def lead_bands():
    start = uk_midnight(FIRST_DELIVERY_DAY)
    end = uk_midnight(LAST_DELIVERY_DAY + timedelta(days=1))
    return accuracy.by_lead(FORECASTS, HOURLY, start, end)


# ---- endpoints ------------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "data": META}


@app.get("/api/days")
def days(cutoff: str = DEFAULT_CUTOFF):
    """The 31 delivery days, each labelled both ways, with a one-line summary."""
    table = decision_table(parse_cutoff(cutoff))
    result = []
    for day, rows in table.groupby("delivery_day"):
        errors = rows["error_mw"]
        result.append({
            **describe_day(day),
            "avg_forecast_mw": rows["forecast_mw"].mean(),
            "avg_actual_mw": rows["actual_mw"].mean(),
            **accuracy.summary(errors),
            "worst_short_mw": errors.max(),
        })
    return to_json({"cutoff": cutoff, "days": result})


@app.get("/api/day/{delivery_day}")
def one_day(delivery_day: str, cutoff: str = DEFAULT_CUTOFF):
    """One delivery day: the forecast you had, what happened, and what you could have known."""
    day = parse_delivery_day(delivery_day)
    cut = parse_cutoff(cutoff)
    table = decision_table(cut)
    rows = table[table["delivery_day"] == day]

    hours = delivery_hours(day)
    half_hours = ACTUALS[(ACTUALS["start_time"] >= hours[0]) & (ACTUALS["start_time"] < hours[-1] + pd.Timedelta(hours=1))]

    return to_json({
        **describe_day(day),
        "cutoff": cutoff,
        "cutoff_utc": cutoff_utc(day, cut),
        "publishes_used": sorted(rows["publish_time"].dropna().unique().tolist()),
        "hours": rows[["start_time", "forecast_mw", "publish_time", "lead_hours", "actual_mw", "error_mw"]].to_dict("records"),
        "half_hourly_actuals": half_hours[["start_time", "actual_mw"]].to_dict("records"),
        "how_it_turned_out": {**accuracy.summary(rows["error_mw"]), "extra_side": accuracy.extra_side(rows["error_mw"])},
        "that_morning": accuracy.that_morning(table, day - timedelta(days=1)),
    })


@app.get("/api/accuracy")
def january_review(cutoff: str = DEFAULT_CUTOFF):
    """January in review: how the forecast you had at the cutoff did over the whole month."""
    table = decision_table(parse_cutoff(cutoff))
    errors = table["error_mw"]
    return to_json({
        "cutoff": cutoff,
        "delivery_days": [FIRST_DELIVERY_DAY, LAST_DELIVERY_DAY],
        **accuracy.summary(errors),
        "cover": accuracy.cover_levels(errors),
        "extra_side": accuracy.extra_side(errors),
        "worst_days": [{**describe_day(d["delivery_day"]), **d} for d in accuracy.worst_days(table)],
        "by_lead_time": lead_bands(),
    })
