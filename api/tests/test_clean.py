from helpers import make_actuals, make_forecasts, utc


def test_hours_already_started_are_dropped():
    f = make_forecasts([
        ("2026-01-14 07:30", "2026-01-14 07:00", 500),  # started before the publish: not a forecast
        ("2026-01-14 07:30", "2026-01-14 08:00", 600),
    ])
    assert f["start_time"].tolist() == [utc("2026-01-14 08:00")]


def test_same_publish_and_hour_twice_keeps_one():
    f = make_forecasts([
        ("2026-01-14 07:30", "2026-01-15 12:00", 100),
        ("2026-01-14 07:30", "2026-01-15 12:00", 200),
    ])
    assert len(f) == 1
    assert f["forecast_mw"].iloc[0] == 200


def test_actuals_duplicates_keep_one():
    a = make_actuals([("2026-01-15 12:00", 100), ("2026-01-15 12:00", 100), ("2026-01-15 12:30", 300)])
    assert len(a) == 2
