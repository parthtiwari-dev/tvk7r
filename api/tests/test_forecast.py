from datetime import date, time

import pandas as pd

from engine.forecast import cutoff_utc, decisions, delivery_hours, forecast_you_had, hourly_actuals
from helpers import make_actuals, make_forecasts, utc

DELIVERY = date(2026, 1, 15)  # decided on Wed 14 Jan
CUTOFF = time(9, 20)
NOON = utc("2026-01-15 12:00")


def at_noon(rows, delivery=DELIVERY, cutoff=CUTOFF, hour=NOON):
    return forecast_you_had(make_forecasts(rows), delivery, cutoff).loc[hour]


# ---- which forecast you had -------------------------------------------------------------------

def test_newest_publish_before_cutoff_is_used():
    had = at_noon([
        ("2026-01-14 04:30", "2026-01-15 12:00", 100),
        ("2026-01-14 07:30", "2026-01-15 12:00", 200),
    ])
    assert had["forecast_mw"] == 200
    assert had["publish_time"] == utc("2026-01-14 07:30")
    assert had["lead_hours"] == 28.5


def test_publish_after_cutoff_is_ignored():
    """The lookahead test: a newer forecast that came out after the cutoff must not be used."""
    had = at_noon([
        ("2026-01-14 07:30", "2026-01-15 12:00", 200),
        ("2026-01-14 09:30", "2026-01-15 12:00", 999),
    ])
    assert had["forecast_mw"] == 200


def test_publish_exactly_at_cutoff_is_too_late():
    had = at_noon([
        ("2026-01-14 07:30", "2026-01-15 12:00", 200),
        ("2026-01-14 09:20", "2026-01-15 12:00", 999),
    ])
    assert had["forecast_mw"] == 200


def test_nothing_before_cutoff_stays_empty():
    had = at_noon([("2026-01-14 09:30", "2026-01-15 12:00", 999)])
    assert pd.isna(had["forecast_mw"])
    assert pd.isna(had["publish_time"])


def test_skipped_hour_falls_back_to_previous_publish():
    had = forecast_you_had(make_forecasts([
        ("2026-01-14 04:30", "2026-01-15 12:00", 100),
        ("2026-01-14 04:30", "2026-01-15 13:00", 110),
        ("2026-01-14 07:30", "2026-01-15 12:00", 200),  # the 07:30 publish skipped 13:00
    ]), DELIVERY, CUTOFF)
    assert had.loc[NOON, "forecast_mw"] == 200
    assert had.loc[utc("2026-01-15 13:00"), "forecast_mw"] == 110
    assert had.loc[utc("2026-01-15 13:00"), "publish_time"] == utc("2026-01-14 04:30")


def test_later_cutoff_picks_the_later_publish():
    had = at_noon([
        ("2026-01-14 07:30", "2026-01-15 12:00", 200),
        ("2026-01-14 09:30", "2026-01-15 12:00", 300),
    ], cutoff=time(9, 50))
    assert had["forecast_mw"] == 300


# ---- UK time vs UTC ---------------------------------------------------------------------------

def test_winter_cutoff_is_the_same_in_utc():
    assert cutoff_utc(DELIVERY, CUTOFF) == utc("2026-01-14 09:20")


def test_summer_cutoff_is_an_hour_earlier_in_utc():
    assert cutoff_utc(date(2026, 7, 15), CUTOFF) == utc("2026-07-14 08:20")


def test_summer_publish_after_uk_cutoff_is_ignored():
    """08:30 UTC is 09:30 UK time in summer: after a 09:20 UK cutoff, so not usable."""
    had = at_noon([
        ("2026-07-14 08:00", "2026-07-15 12:00", 200),
        ("2026-07-14 08:30", "2026-07-15 12:00", 999),
    ], delivery=date(2026, 7, 15), hour=utc("2026-07-15 12:00"))
    assert had["forecast_mw"] == 200


def test_delivery_day_is_a_uk_day():
    winter = delivery_hours(DELIVERY)
    summer = delivery_hours(date(2026, 7, 15))
    assert len(winter) == 24 and winter[0] == utc("2026-01-15 00:00")
    assert len(summer) == 24 and summer[0] == utc("2026-07-14 23:00")


def test_clock_change_days_have_23_and_25_hours():
    assert len(delivery_hours(date(2026, 3, 29))) == 23
    assert len(delivery_hours(date(2026, 10, 25))) == 25


# ---- pairing with actuals ---------------------------------------------------------------------

def test_hourly_actual_is_the_average_of_its_two_half_hours():
    hourly = hourly_actuals(make_actuals([("2026-01-15 12:00", 9000), ("2026-01-15 12:30", 9500)]))
    assert hourly.loc[NOON] == 9250


def test_hour_with_a_missing_half_hour_has_no_actual():
    hourly = hourly_actuals(make_actuals([("2026-01-15 12:00", 9000), ("2026-01-15 13:30", 9500)]))
    assert hourly.isna().all()


def test_error_is_forecast_minus_actual():
    forecasts = make_forecasts([("2026-01-14 07:30", "2026-01-15 12:00", 11000)])
    hourly = hourly_actuals(make_actuals([("2026-01-15 12:00", 9800), ("2026-01-15 12:30", 9800)]))
    table = decisions(forecasts, hourly, [DELIVERY], CUTOFF)
    noon = table[table["start_time"] == NOON].iloc[0]
    assert noon["error_mw"] == 1200  # positive: wind came in below forecast, you were short
    assert noon["delivery_day"] == DELIVERY
    assert len(table) == 24
