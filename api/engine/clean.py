"""Turn the raw snapshot tables into clean ones the rest of the engine can trust."""

import pandas as pd


def prepare_actuals(raw):
    """Half-hourly wind actuals: start_time (UTC), actual_mw."""
    actuals = pd.DataFrame({
        "start_time": pd.to_datetime(raw["startTime"], utc=True),
        "actual_mw": raw["generation"].astype(float),
    })
    actuals = actuals.drop_duplicates("start_time", keep="last")
    return actuals.sort_values("start_time").reset_index(drop=True)


def prepare_forecasts(raw):
    """Hourly wind forecasts: publish_time, start_time (both UTC), forecast_mw."""
    forecasts = pd.DataFrame({
        "publish_time": pd.to_datetime(raw["publishTime"], utc=True),
        "start_time": pd.to_datetime(raw["startTime"], utc=True),
        "forecast_mw": raw["generation"].astype(float),
    })
    forecasts = drop_duplicate_rows(forecasts)
    forecasts = drop_past_hours(forecasts)
    return forecasts.sort_values(["publish_time", "start_time"]).reset_index(drop=True)


def drop_duplicate_rows(forecasts):
    """If one publish has the same hour twice, keep one (the last one seen)."""
    return forecasts.drop_duplicates(["publish_time", "start_time"], keep="last")


def drop_past_hours(forecasts):
    """Each publish also lists hours that had already started. Those are not forecasts: drop them."""
    return forecasts[forecasts["start_time"] >= forecasts["publish_time"]]
