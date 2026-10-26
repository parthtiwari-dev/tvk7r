"""Cross-check on the real January snapshot.

The expected numbers were worked out separately, with different code, while exploring the data.
If this engine lands on the same numbers, both are very likely right.
"""

from datetime import date, time, timedelta

import pytest

from engine import accuracy
from engine.forecast import decisions, hourly_actuals, uk_midnight
from helpers import utc
from snapshot import load_snapshot

DELIVERY_DAYS = [date(2026, 1, 2) + timedelta(days=i) for i in range(31)]


@pytest.fixture(scope="module")
def data():
    actuals, forecasts, _ = load_snapshot()
    hourly = hourly_actuals(actuals)
    return forecasts, hourly, decisions(forecasts, hourly, DELIVERY_DAYS, time(9, 20))


def test_snapshot_is_complete():
    actuals, forecasts, meta = load_snapshot()
    assert len(actuals) == 34 * 48  # 31 Dec to 2 Feb, every half-hour
    assert meta["forecasts"]["publishes"] == 35 * 8  # 29 Dec to 1 Feb, 8 a day


def test_january_at_0920(data):
    _, _, table = data
    s = accuracy.summary(table["error_mw"])
    assert s["hours"] == 744
    assert round(s["typical_miss_mw"]) == 2039
    assert round(s["bias_mw"]) == 1748
    assert s["short_hours"] == 632
    assert round(accuracy.cover(table["error_mw"], 0.9)["cover_mw"]) == 4098


def test_noon_15_jan(data):
    _, _, table = data
    noon = table[table["start_time"] == utc("2026-01-15 12:00")].iloc[0]
    assert noon["publish_time"] == utc("2026-01-14 07:30")
    assert noon["forecast_mw"] == 11049
    assert noon["actual_mw"] == 9790.5


def test_what_you_knew_on_the_morning_of_10_jan(data):
    _, _, table = data
    m = accuracy.that_morning(table, date(2026, 1, 10))
    assert m["past_days"] == 8
    assert round(m["cover"][1]["cover_mw"]) == 3459


def test_shortest_lead_band(data):
    forecasts, hourly, _ = data
    bands = accuracy.by_lead(forecasts, hourly, uk_midnight(date(2026, 1, 2)), uk_midnight(date(2026, 2, 2)))
    assert bands[0]["forecasts"] == 1488
    assert round(bands[0]["typical_miss_mw"]) == 1660
