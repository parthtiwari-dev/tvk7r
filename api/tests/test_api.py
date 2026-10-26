import pytest
from fastapi.testclient import TestClient

from app import app


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_days_lists_31_days_labelled_both_ways(client):
    days = client.get("/api/days").json()["days"]
    assert len(days) == 31
    assert days[13]["label"] == "Decide Wed 14 Jan, delivery Thu 15 Jan"


def test_days_count_hours_beyond_that_mornings_cover(client):
    days = {d["delivery_day"]: d for d in client.get("/api/days").json()["days"]}
    assert days["2026-01-28"]["hours_beyond_cover"]["1 in 10"] == 24  # the day the cover failed
    assert days["2026-01-15"]["hours_beyond_cover"]["1 in 10"] == 0
    assert days["2026-01-02"]["hours_beyond_cover"] == {}  # no finished day that morning


def test_one_day(client):
    d = client.get("/api/day/2026-01-15").json()
    assert d["cutoff_utc"] == "2026-01-14T09:20:00Z"
    assert d["publishes_used"] == ["2026-01-14T07:30:00Z"]
    assert len(d["hours"]) == 24
    assert len(d["half_hourly_actuals"]) == 48
    assert d["that_morning"]["past_days"] == 12  # decided 14 Jan: delivery days 2 to 13 Jan are over


def test_later_cutoff_uses_the_0930_publish(client):
    d = client.get("/api/day/2026-01-15", params={"cutoff": "09:50"}).json()
    assert d["publishes_used"] == ["2026-01-14T09:30:00Z"]


def test_january_review(client):
    r = client.get("/api/accuracy").json()
    assert r["hours"] == 744
    assert [c["risk"] for c in r["cover"]] == ["1 in 5", "1 in 10", "1 in 20"]
    assert r["by_lead_time"][0]["from_hours"] == 0
    assert len(r["worst_days"]) == 5


@pytest.mark.parametrize("path", [
    "/api/day/15-01-2026",              # wrong date format
    "/api/day/2026-03-01",              # outside January's decisions
    "/api/day/2026-01-15?cutoff=9am",   # wrong cutoff format
    "/api/day/2026-01-15?cutoff=25:00",  # not a time
    "/api/accuracy?cutoff=0920",
])
def test_bad_input_gets_a_clear_400(client, path):
    r = client.get(path)
    assert r.status_code == 400
    assert r.json()["detail"]
