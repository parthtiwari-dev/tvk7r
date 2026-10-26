from datetime import date

import pandas as pd
import pytest

from engine import accuracy
from engine.forecast import hourly_actuals
from helpers import make_actuals, make_forecasts, utc


def test_summary_worked_by_hand():
    s = accuracy.summary(pd.Series([100, -100, 300, None]))  # the missing hour is left out
    assert s["hours"] == 3
    assert s["typical_miss_mw"] == pytest.approx(500 / 3)
    assert s["bias_mw"] == pytest.approx(100)
    assert s["short_hours"] == 2


def test_cover_worked_by_hand():
    errors = pd.Series([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    c = accuracy.cover(errors, 0.9)
    # 90% of the way from 100 to 1000 in steps: 900 + 0.1 * 100
    assert c["cover_mw"] == pytest.approx(910)
    assert c["still_short_pct"] == pytest.approx(10)  # only the 1000 hour beats it
    # unused cover per hour: 810, 710, ..., 10, and 0 for the hour that used all of it
    assert c["unneeded_cover_mw"] == pytest.approx(369)


def test_cover_counts_all_of_it_as_unneeded_when_wind_beats_the_forecast():
    c = accuracy.cover(pd.Series([-500, 1000, 1000, 1000]), 0.5)
    assert c["cover_mw"] == 1000
    assert c["unneeded_cover_mw"] == pytest.approx(250)  # the -500 hour wasted all 1000


def test_hours_beyond_counts_only_shortfalls_bigger_than_the_cover():
    errors = pd.Series([5000, 4559, -6000, None, 4560])  # equal to the cover is not beyond it
    assert accuracy.hours_beyond(errors, 4559) == 2


def test_cover_is_never_negative():
    c = accuracy.cover(pd.Series([-100, -200, -300]), 0.9)
    assert c["cover_mw"] == 0
    assert c["still_short_pct"] == 0
    assert c["unneeded_cover_mw"] == 0


def test_cover_levels_are_1_in_5_10_20():
    levels = accuracy.cover_levels(pd.Series(range(100)))
    assert [lvl["risk"] for lvl in levels] == ["1 in 5", "1 in 10", "1 in 20"]
    assert [lvl["covered_pct"] for lvl in levels] == pytest.approx([80, 90, 95])


def test_extra_side_worked_by_hand():
    e = accuracy.extra_side(pd.Series([-100, -300, 200, None]))
    assert e["hours"] == 2
    assert e["pct_of_hours"] == pytest.approx(200 / 3)
    assert e["typical_extra_mw"] == 200


def day_table(errors_by_day):
    rows = [{"delivery_day": day, "error_mw": e} for day, errors in errors_by_day.items() for e in errors]
    return pd.DataFrame(rows)


def test_that_morning_never_uses_a_later_day():
    table = day_table({
        date(2026, 1, 2): [100, 300],
        date(2026, 1, 3): [200, 200],
        date(2026, 1, 4): [99999, 99999],  # the decision on 4 Jan must not see this day
        date(2026, 1, 5): [99999, 99999],
    })
    m = accuracy.that_morning(table, date(2026, 1, 4))
    assert m["past_days"] == 2
    assert m["bias_mw"] == 200


def test_that_morning_with_no_past_days():
    table = day_table({date(2026, 1, 2): [100]})
    m = accuracy.that_morning(table, date(2026, 1, 1))
    assert m["past_days"] == 0
    assert m["hours"] == 0
    assert m["cover"] == []


def test_worst_days_are_the_most_short_on_average():
    table = day_table({
        date(2026, 1, 2): [100, 100],
        date(2026, 1, 3): [900, 700],
        date(2026, 1, 4): [-500, -500],
    })
    worst = accuracy.worst_days(table, n=2)
    assert [d["delivery_day"] for d in worst] == [date(2026, 1, 3), date(2026, 1, 2)]
    assert worst[0]["bias_mw"] == 800


def test_by_lead_groups_every_publish_into_bands():
    forecasts = make_forecasts([
        ("2026-01-15 09:30", "2026-01-15 12:00", 1100),  # 2.5 h ahead
        ("2026-01-15 07:30", "2026-01-15 12:00", 1300),  # 4.5 h ahead
        ("2026-01-15 04:30", "2026-01-15 12:00", 900),   # 7.5 h ahead
    ])
    hourly = hourly_actuals(make_actuals([("2026-01-15 12:00", 1000), ("2026-01-15 12:30", 1000)]))
    bands = accuracy.by_lead(forecasts, hourly, utc("2026-01-15"), utc("2026-01-16"))
    assert [(b["from_hours"], b["to_hours"], b["forecasts"]) for b in bands] == [(0, 6, 2), (6, 12, 1)]
    assert bands[0]["typical_miss_mw"] == 200
    assert bands[1]["bias_mw"] == -100
