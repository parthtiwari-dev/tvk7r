"""How wrong the forecasts were, in numbers a trader can act on.

Every function takes errors in MW where error = forecast minus actual, so a positive error means
wind came in below forecast (you were short). Hours with no actual are left out.
"""

import pandas as pd

# How often the trader accepts being caught short, as the share of hours covered.
RISK_LEVELS = {"1 in 5": 0.8, "1 in 10": 0.9, "1 in 20": 0.95}


def known(errors):
    """The hours that have an error (both a forecast and an actual), as floats."""
    return errors.dropna().astype(float)


def summary(errors):
    """Typical miss (average size of the miss), bias (average signed miss) and hour counts."""
    e = known(errors)
    if e.empty:
        return {"hours": 0, "typical_miss_mw": None, "bias_mw": None, "short_hours": 0}
    return {
        "hours": len(e),
        "typical_miss_mw": e.abs().mean(),
        "bias_mw": e.mean(),
        "short_hours": int((e > 0).sum()),
    }


def cover(errors, level=0.9):
    """Cover sized from the short side: the shortfall that only (1 - level) of hours went beyond.

    Also what that cover costs: how many hours were still short, and on average how much of the
    cover was bought but not needed.
    """
    e = known(errors)
    if e.empty:
        return None
    cover_mw = max(e.quantile(level), 0.0)
    used = e.clip(lower=0, upper=cover_mw)  # the part of the cover each hour actually needed
    return {
        "covered_pct": 100 * level,
        "cover_mw": cover_mw,
        "still_short_pct": 100 * (e > cover_mw).mean(),
        "unneeded_cover_mw": (cover_mw - used).mean(),
    }


def cover_levels(errors):
    """Cover at each risk level: 1 hour in 5, 1 in 10, 1 in 20."""
    return [{"risk": name, **(cover(errors, level) or {})} for name, level in RISK_LEVELS.items()]


def extra_side(errors):
    """The other way round: hours where wind beat the forecast, and by how much typically."""
    e = known(errors)
    extra = -e[e < 0]
    return {
        "hours": len(extra),
        "pct_of_hours": 100 * len(extra) / len(e) if len(e) else None,
        "typical_extra_mw": extra.mean() if len(extra) else None,
    }


def worst_days(table, n=5):
    """Delivery days where wind fell furthest below forecast on average."""
    by_day = table.dropna(subset=["error_mw"]).groupby("delivery_day")["error_mw"]
    days = pd.DataFrame({"bias_mw": by_day.mean(), "typical_miss_mw": by_day.apply(lambda e: e.abs().mean())})
    days = days.sort_values("bias_mw", ascending=False).head(n)
    return [{"delivery_day": day, **row} for day, row in days.to_dict("index").items()]


def that_morning(table, decision_day):
    """What the trader could have known on the decision morning.

    Uses only delivery days fully finished before that morning (delivery day < decision day),
    so nothing from after the decision leaks in.
    """
    past = table[table["delivery_day"] < decision_day]
    return {
        "past_days": past["delivery_day"].nunique(),
        **summary(past["error_mw"]),
        "cover": cover_levels(past["error_mw"]) if past["error_mw"].notna().any() else [],
    }


def by_lead(forecasts, hourly, start, end, band_hours=6):
    """Error by lead time (how far ahead the forecast was made), from every publish.

    Covers forecasts for hours from start to end (UTC). Each band reports how many forecasts it
    is built from, because the longest leads have few.
    """
    f = forecasts[(forecasts["start_time"] >= start) & (forecasts["start_time"] < end)].copy()
    f["lead_hours"] = (f["start_time"] - f["publish_time"]) / pd.Timedelta(hours=1)
    f["error_mw"] = f["forecast_mw"] - hourly.reindex(f["start_time"]).to_numpy()
    f = f.dropna(subset=["error_mw"])
    f["band"] = (f["lead_hours"] // band_hours * band_hours).astype(int)

    bands = []
    for band, group in f.groupby("band"):
        bands.append({
            "from_hours": band,
            "to_hours": band + band_hours,
            "forecasts": len(group),
            "typical_miss_mw": group["error_mw"].abs().mean(),
            "bias_mw": group["error_mw"].mean(),
            "cover_1_in_10_mw": cover(group["error_mw"], 0.9)["cover_mw"],
        })
    return bands
