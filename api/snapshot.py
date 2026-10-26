"""Read the cached data snapshot in api/data/ (written by scripts/refresh_data.py)."""

import json
from pathlib import Path

import pandas as pd

from engine.clean import prepare_actuals, prepare_forecasts

DATA_DIR = Path(__file__).resolve().parent / "data"


def load_snapshot(data_dir=DATA_DIR):
    """Returns (actuals, forecasts, meta), cleaned and ready for the engine."""
    actuals = prepare_actuals(pd.read_csv(data_dir / "actuals.csv"))
    forecasts = prepare_forecasts(pd.read_csv(data_dir / "forecasts.csv"))
    meta = json.loads((data_dir / "meta.json").read_text())
    return actuals, forecasts, meta
