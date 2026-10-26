"""Build small hand-made tables in the same shape as the snapshot CSVs. Times are UTC."""

import pandas as pd

from engine.clean import prepare_actuals, prepare_forecasts


def make_forecasts(rows):
    """rows: (publish time, start time, MW)."""
    return prepare_forecasts(pd.DataFrame(rows, columns=["publishTime", "startTime", "generation"]))


def make_actuals(rows):
    """rows: (start time, MW)."""
    return prepare_actuals(pd.DataFrame(rows, columns=["startTime", "generation"]))


def utc(text):
    return pd.Timestamp(text, tz="UTC")
