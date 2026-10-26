"""The core rule: the forecast you had at the cutoff, paired with what actually happened."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

UK = ZoneInfo("Europe/London")
ONE_HOUR = pd.Timedelta(hours=1)
HALF_HOUR = pd.Timedelta(minutes=30)


def uk_midnight(day):
    """Start of a UK day, in UTC."""
    return pd.Timestamp(datetime.combine(day, time()), tz=UK).tz_convert("UTC")


def cutoff_utc(delivery_day, cutoff):
    """The cutoff is a UK clock time on the day before delivery. Returns it in UTC."""
    decision_day = delivery_day - timedelta(days=1)
    return pd.Timestamp(datetime.combine(decision_day, cutoff), tz=UK).tz_convert("UTC")


def delivery_hours(delivery_day):
    """Every hour of a UK delivery day, in UTC. 24 hours, or 23 / 25 on clock-change days."""
    start = uk_midnight(delivery_day)
    end = uk_midnight(delivery_day + timedelta(days=1))
    return pd.date_range(start, end, freq="h", inclusive="left", name="start_time")


def forecast_you_had(forecasts, delivery_day, cutoff):
    """For each hour of the delivery day, the newest forecast published strictly before the cutoff.

    If the newest publish skipped an hour, that hour falls back to the newest one that has it.
    An hour with nothing published before the cutoff stays empty: it is never guessed.
    Returns one row per hour: forecast_mw, publish_time, lead_hours.
    """
    hours = delivery_hours(delivery_day)
    cutoff_at = cutoff_utc(delivery_day, cutoff)

    available = forecasts[(forecasts["publish_time"] < cutoff_at) & forecasts["start_time"].isin(hours)]
    newest = available.sort_values("publish_time").groupby("start_time").tail(1)

    had = newest.set_index("start_time").reindex(hours)[["forecast_mw", "publish_time"]]
    had["lead_hours"] = (had.index.to_series() - had["publish_time"]) / ONE_HOUR
    return had


def hourly_actuals(actuals):
    """Hourly actual = average of the two half-hours that start at that hour.

    If either half-hour is missing, the hour has no actual (NaN) rather than half an answer.
    """
    half_hourly = actuals.set_index("start_time")["actual_mw"]
    hours = half_hourly.index.floor("h").unique()
    first = half_hourly.reindex(hours).to_numpy()
    second = half_hourly.reindex(hours + HALF_HOUR).to_numpy()
    return pd.Series((first + second) / 2, index=hours, name="actual_mw")


def decisions(forecasts, hourly, delivery_days, cutoff):
    """One row per delivery hour: the forecast you had, the actual, and the error.

    Error = forecast minus actual. Positive means wind came in below forecast: you were short.
    """
    frames = []
    for day in delivery_days:
        had = forecast_you_had(forecasts, day, cutoff)
        had["delivery_day"] = day
        frames.append(had)
    table = pd.concat(frames)
    table["actual_mw"] = hourly.reindex(table.index).to_numpy()
    table["error_mw"] = table["forecast_mw"] - table["actual_mw"]
    return table.reset_index()
