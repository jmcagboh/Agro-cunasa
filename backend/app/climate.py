"""Analyse climatique à partir des données journalières NASA POWER."""
import numpy as np
import pandas as pd

HOT_DAY_C = 35.0        # jour de chaleur extrême (T2M_MAX > seuil)
FROST_C = 2.0           # risque de gel (T2M_MIN <= seuil)
HEAVY_RAIN_MM = 20.0    # pluie extrême (mm/jour)
DRY_THRESHOLD = -20.0   # mois sec si P - ETP < seuil (mm)
HUMID_THRESHOLD = 20.0  # mois humide si P - ETP > seuil (mm)


def hargreaves_pet(df: pd.DataFrame, lat: float) -> pd.Series:
    """ETP journalière (mm/j) par Hargreaves, à partir de T2M, T2M_MIN, T2M_MAX et latitude."""
    phi = np.radians(lat)
    j = df.index.day_of_year.to_numpy()
    dr = 1 + 0.033 * np.cos(2 * np.pi * j / 365)
    delta = 0.409 * np.sin(2 * np.pi * j / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(delta), -1, 1))
    ra = (24 * 60 / np.pi) * 0.0820 * dr * (
        ws * np.sin(phi) * np.sin(delta) + np.cos(phi) * np.cos(delta) * np.sin(ws))
    trange = (df["T2M_MAX"] - df["T2M_MIN"]).clip(lower=0)
    pet = 0.0023 * (df["T2M"] + 17.8) * np.sqrt(trange) * 0.408 * ra
    return pd.Series(pet.clip(lower=0), index=df.index)


def _longest_circular_run(flags: list[bool]) -> tuple[int, int] | None:
    """Plus longue suite de mois consécutifs (circulaire) où flags=True. Retourne (début, fin) en mois 1-12."""
    if all(flags):
        return (1, 12)
    if not any(flags):
        return None
    best_len, best_start = 0, 0
    for s in range(12):
        if flags[s] and not flags[(s - 1) % 12]:
            n = 0
            while flags[(s + n) % 12] and n < 12:
                n += 1
            if n > best_len:
                best_len, best_start = n, s
    return (best_start + 1, (best_start + best_len - 1) % 12 + 1)


def analyze(df: pd.DataFrame, lat: float) -> dict:
    df = df.copy()
    df["PET"] = hargreaves_pet(df, lat)
    df["year"], df["month"] = df.index.year, df.index.month

    # --- Séries mensuelles -------------------------------------------------
    g = df.groupby(["year", "month"])
    cols = {
        "precip_mm": g["PRECTOTCORR"].sum(min_count=1),
        "t2m": g["T2M"].mean(), "t2m_min": g["T2M_MIN"].mean(), "t2m_max": g["T2M_MAX"].mean(),
        "rh2m": g["RH2M"].mean(), "solar": g["ALLSKY_SFC_SW_DWN"].mean(),
        "pet_mm": g["PET"].sum(min_count=1),
        "soil_wetness_root": g["GWETROOT"].mean(),
        "soil_wetness_top": g["GWETTOP"].mean(),
    }
    if "EVPTRNS" in df.columns:
        cols["evptrns_mj"] = g["EVPTRNS"].mean()
    monthly = pd.DataFrame(cols).reset_index()

    # --- Annuel : tendances et anomalies ----------------------------------
    full_years = df.groupby("year").size()
    full_years = full_years[full_years >= 360].index
    ann = df[df["year"].isin(full_years)].groupby("year").agg(
        temp=("T2M", "mean"), precip=("PRECTOTCORR", "sum"))
    ann = ann.dropna()
    yrs = ann.index.values.astype(float)

    def slope_per_decade(y):
        return float(np.polyfit(yrs, y.values, 1)[0] * 10) if len(yrs) >= 5 else None

    p_mean, t_mean = ann["precip"].mean(), ann["temp"].mean()
    p_slope = slope_per_decade(ann["precip"])
    t_slope = slope_per_decade(ann["temp"])
    trends = {
        "temp_slope_c_per_decade": t_slope,
        "t2m_c_per_decade": t_slope,
        "precip_slope_pct_per_decade": (p_slope / p_mean * 100) if p_slope is not None and p_mean else None,
        "precip_mm_per_decade": p_slope,
        "mean_annual_precip_mm": float(p_mean), "mean_annual_temp_c": float(t_mean),
    }
    anomalies = [{"year": int(y), "temp": float(r.temp - t_mean),
                  "precip_pct": float((r.precip - p_mean) / p_mean * 100)}
                 for y, r in ann.iterrows()]

    # --- Extrêmes ---------------------------------------------------------
    d = df[df["year"].isin(full_years)]
    n_years = max(len(full_years), 1)
    hot = float((d["T2M_MAX"] > HOT_DAY_C).sum() / n_years)
    heavy = float((d["PRECTOTCORR"] >= HEAVY_RAIN_MM).sum() / n_years)
    extremes = {
        "hot_days_avg": hot,
        "heat_days_per_year": hot,
        "frost_risk_pct": float(d.groupby("year")["T2M_MIN"].min().le(FROST_C).mean() * 100),
        "frost_days_per_year": float((d["T2M_MIN"] <= 0).sum() / n_years),
        "heavy_rain_days_avg": heavy,
        "extreme_rain_days_per_year": float((d["PRECTOTCORR"] >= 50).sum() / n_years),
        "thresholds": {"hot_day_c": HOT_DAY_C, "frost_c": 0, "frost_risk_c": FROST_C,
                       "heavy_rain_mm": HEAVY_RAIN_MM, "extreme_rain_mm": 50},
    }

    # --- Bilan hydrique mensuel moyen ------------------------------------
    clim = monthly.groupby("month")[["precip_mm", "pet_mm"]].mean()
    water_balance, wet_flags = [], []
    for m in range(1, 13):
        p, e = float(clim.loc[m, "precip_mm"]), float(clim.loc[m, "pet_mm"])
        diff = p - e
        klass = "dry" if diff < DRY_THRESHOLD else "humid" if diff > HUMID_THRESHOLD else "neutral"
        water_balance.append({"month": m, "precip_mm": p, "pet_mm": e,
                              "p_minus_pet_mm": diff, "klass": klass})
        wet_flags.append(e > 0 and p >= 0.5 * e)

    run = _longest_circular_run(wet_flags)
    growing = [i + 1 for i, flag in enumerate(wet_flags) if flag]
    runs = sum(1 for i in range(12) if wet_flags[i] and not wet_flags[(i - 1) % 12])
    season = {
        "start_month": run[0] if run else None,
        "end_month": run[1] if run else None,
        "growing_months": growing,
        "rainy_seasons": 2 if runs >= 2 else 1,
        "length_days": int(round(len(growing) * 30.4)),
        "rule": ("mois où les précipitations atteignent au moins la moitié de l'évapotranspiration"
                 if run else "aucune saison pluviale nette détectée"),
    }

    cv = {
        "precip": float(ann["precip"].std() / p_mean) if p_mean else None,
        "t2m": float(ann["temp"].std() / t_mean) if t_mean else None,
        "temp_std_c": float(ann["temp"].std()),
    }
    return {"monthly": monthly.replace({np.nan: None}).to_dict("records"),
            "trends": trends, "anomalies": anomalies, "extremes": extremes,
            "water_balance": water_balance, "season": season, "interannual_cv": cv}
