"""Tests unitaires du moteur de score (données climatiques synthétiques, sans réseau)."""
import numpy as np
import pandas as pd
import pytest

from backend.app.climate import analyze
from backend.app.knowledge import load_crops
from backend.app.scoring import (CLIMATE_FIT_WEIGHT, PRIORITY_KEYS, build_profile, crop_fit,
                                 normalize_weights, recommend, score_rotation)

DB = load_crops()
EQUAL = {k: 5 for k in PRIORITY_KEYS}


def make_climate(kind: str) -> dict:
    idx = pd.date_range("2011-01-01", "2025-12-31")
    doy = idx.day_of_year.to_numpy()
    rng = np.random.default_rng(1)
    if kind == "tropical":      # chaud, deux saisons des pluies
        t = 27 + 1.5 * np.sin(doy / 365 * 4 * np.pi)
        p = rng.gamma(0.5, 5.0, len(idx)) * (1.1 + np.sin(doy / 365 * 4 * np.pi))
    else:                       # tempéré : hiver froid, pluies régulières
        t = 11 + 11 * np.sin((doy - 100) / 365 * 2 * np.pi)
        p = rng.gamma(0.5, 5.0, len(idx))
    df = pd.DataFrame({"PRECTOTCORR": p, "T2M": t, "T2M_MIN": t - 4, "T2M_MAX": t + 4, "RH2M": 70.0,
                       "ALLSKY_SFC_SW_DWN": 5.0, "GWETROOT": 0.5, "GWETTOP": 0.5}, index=idx)
    return analyze(df, 6.13 if kind == "tropical" else 48.0)


PARCEL = {"soil": "loam", "slope": "flat", "irrigation": False, "rainy_seasons": 2}


@pytest.fixture(scope="module")
def tropical():
    return build_profile(make_climate("tropical"), PARCEL, {})


@pytest.fixture(scope="module")
def temperate():
    return build_profile(make_climate("temperate"), PARCEL, {})


def test_breakdown_sums_to_total(tropical):
    fits = {c: crop_fit(cr, tropical) for c, cr in DB.items()}
    sc = score_rotation(DB, ["maize", "cowpea", "sorghum"], fits, normalize_weights({"water": 9, "income": 2}))
    assert sum(b["contribution"] for b in sc["breakdown"]) == pytest.approx(sc["total"] * 100, abs=0.2)
    assert sum(b["weight_pct"] for b in sc["breakdown"]) == pytest.approx(100, abs=0.5)


def test_climate_fit_weight_is_fixed(tropical):
    fits = {c: crop_fit(cr, tropical) for c, cr in DB.items()}
    sc = score_rotation(DB, ["maize", "cowpea"], fits, EQUAL)
    row = [b for b in sc["breakdown"] if b["criterion"] == "climate_fit"][0]
    assert row["weight_pct"] == pytest.approx(CLIMATE_FIT_WEIGHT * 100)


def test_zero_priorities_fall_back_to_equal_weights():
    w = normalize_weights({k: 0 for k in PRIORITY_KEYS})
    assert all(v == 1.0 for v in w.values())


def test_at_least_three_strategies_with_baseline_first(tropical):
    out = recommend(DB, tropical, ["maize", "cassava"], EQUAL)
    assert len(out["strategies"]) >= 3
    assert out["strategies"][0]["is_baseline"] and out["strategies"][0]["sequence"] == ["maize", "cassava"]
    assert len({tuple(sorted(s["sequence"])) for s in out["strategies"]}) == len(out["strategies"])


def test_nitrogen_priority_favours_legumes(tropical):
    pri = {k: 0 for k in PRIORITY_KEYS} | {"nitrogen": 10}
    out = recommend(DB, tropical, ["maize", "sorghum"], pri)
    base, balanced = out["strategies"][0], out["strategies"][1]
    assert balanced["criteria_scores"]["nitrogen"] > base["criteria_scores"]["nitrogen"]
    assert any(DB[c]["family"] == "Fabaceae" for c in balanced["sequence"])


def test_priorities_change_the_ranking(tropical):
    water = recommend(DB, tropical, ["maize", "cassava"], {k: 0 for k in PRIORITY_KEYS} | {"water": 10})
    income = recommend(DB, tropical, ["maize", "cassava"], {k: 0 for k in PRIORITY_KEYS} | {"income": 10})
    assert water["strategies"][1]["sequence"] != income["strategies"][1]["sequence"]


def test_frost_sensitive_crop_excluded_in_temperate(temperate):
    assert not crop_fit(DB["cassava"], temperate)["ok"]
    assert crop_fit(DB["wheat"], temperate)["ok"]


def test_cool_crop_excluded_in_hot_tropics(tropical):
    assert not crop_fit(DB["wheat"], tropical)["ok"]
    assert not crop_fit(DB["potato"], tropical)["ok"]


def test_drought_scenario_reduces_fit_of_water_hungry_crop():
    clim = make_climate("tropical")
    normal = build_profile(clim, PARCEL, {})
    dry = build_profile(clim, PARCEL, {"precip_delta_pct": -40})
    assert crop_fit(DB["maize"], normal)["ok"]
    assert crop_fit(DB["maize"], dry)["fit"] < crop_fit(DB["maize"], normal)["fit"]
    assert crop_fit(DB["millet"], dry)["ok"]   # culture tolérante à la sécheresse


def test_irrigation_lifts_water_exclusion():
    clim = make_climate("tropical")
    dry = build_profile(clim, PARCEL, {"precip_delta_pct": -60})
    irrigated = build_profile(clim, PARCEL | {"irrigation": True}, {"precip_delta_pct": -60})
    assert not crop_fit(DB["maize"], dry)["ok"] and crop_fit(DB["maize"], irrigated)["ok"]


def test_monoculture_scores_lower_on_pest_break(tropical):
    fits = {c: crop_fit(cr, tropical) for c, cr in DB.items()}
    mono = score_rotation(DB, ["maize", "maize"], fits, EQUAL)["criteria"]["pest_break"]
    div = score_rotation(DB, ["maize", "cowpea"], fits, EQUAL)["criteria"]["pest_break"]
    assert div > mono
