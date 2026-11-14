"""Orchestration : climat (NASA POWER) -> profil -> recommandations."""
from functools import lru_cache

from .climate import analyze
from .knowledge import load_crops
from .power_client import fetch_daily
from .scoring import (CLIMATE_FIT_WEIGHT, HOT_DAYS_PER_DEGREE, PET_PER_DEGREE, build_profile, recommend)


def _climatology(monthly: list[dict]) -> list[dict]:
    buckets: dict[int, dict[str, list]] = {m: {"precip_mm": [], "t2m": [], "pet_mm": [], "gwetroot": [], "gwettop": []}
                                           for m in range(1, 13)}
    for row in monthly:
        b = buckets[row["month"]]
        for src, dst in (("precip_mm", "precip_mm"), ("t2m", "t2m"), ("pet_mm", "pet_mm"),
                         ("soil_wetness_root", "gwetroot"), ("soil_wetness_top", "gwettop")):
            value = row.get(src)
            if value is not None:
                b[dst].append(value)

    def avg(values: list):
        return sum(values) / len(values) if values else None

    return [{"month": m, "precip_mm": avg(b["precip_mm"]), "t2m": avg(b["t2m"]), "pet_mm": avg(b["pet_mm"]),
             "gwetroot": avg(b["gwetroot"]), "gwettop": avg(b["gwettop"])} for m, b in buckets.items()]


def _climate_type(raw: dict) -> str:
    temp = raw["trends"].get("mean_annual_temp_c") or 0
    precip = raw["trends"].get("mean_annual_precip_mm") or 0
    frost = raw["extremes"].get("frost_risk_pct") or 0
    seasons = raw["season"].get("rainy_seasons") or 1
    if frost >= 30 or temp < 14:
        return "temperate"
    if precip < 500:
        return "semi_arid"
    return "tropical_bimodal" if seasons == 2 else "tropical_unimodal"


def pack_climate(raw: dict, lat: float, lon: float, period: str, source: str, is_demo: bool, notes: list[str]) -> dict:
    """Ajoute climatologie, anomalies du dernier mois-type et le type de climat."""
    climatology = _climatology(raw["monthly"])
    last_year = max((row["year"] for row in raw["monthly"]), default=None)
    by_month = {(row["year"], row["month"]): row for row in raw["monthly"]}
    anomalies = []
    if last_year is not None:
        for clim in climatology:
            row = by_month.get((last_year, clim["month"]))
            if not row or row.get("t2m") is None or clim["t2m"] is None:
                continue
            precip_gap = None
            if row.get("precip_mm") is not None and clim["precip_mm"] is not None:
                precip_gap = row["precip_mm"] - clim["precip_mm"]
            anomalies.append({"month": clim["month"], "year": last_year,
                              "precip_mm": precip_gap, "t2m_c": row["t2m"] - clim["t2m"]})
    return {
        "source": source, "is_demo": is_demo, "pet_method": "hargreaves",
        "lat": lat, "lon": lon, "period": period, "climate_type": _climate_type(raw),
        "climatology": climatology, "notes": notes,
        **raw, "anomalies_annual": raw["anomalies"], "anomalies": anomalies,
    }

ASSUMPTIONS = [
    "ETP estimée par la méthode de Hargreaves (T2M, T2M_MIN, T2M_MAX, latitude), pas mesurée.",
    "Seuils : jour de chaleur extrême > 35 °C ; gel ≤ 2 °C ; pluie extrême ≥ 20 mm/jour.",
    f"Le critère « adaptation au climat » pèse {int(CLIMATE_FIT_WEIGHT * 100)} % du score total ; les 7 priorités se partagent le reste.",
    "Valeurs agronomiques des cultures indicatives (échelle 0-1) : à valider avec des experts locaux.",
    f"Scénario : +1 °C = +{int(PET_PER_DEGREE * 100)} % d'ETP et +{HOT_DAYS_PER_DEGREE:g} jours de chaleur extrême ; "
    "simple test de sensibilité, pas une projection climatique.",
    "Le sol (sableux/limoneux/argileux) ajuste de façon simple l'eau disponible (-10 % / 0 / +5 %).",
    "Les fenêtres de semis sont calculées à partir du climat moyen ; les calendriers locaux peuvent différer.",
    "L'interface est en français ou en anglais. Les notes agronomiques des cultures restent en français.",
    "EVPTRNS (flux d'énergie NASA POWER, MJ/m²/jour) est archivé. Le bilan P − ETP utilise Hargreaves, "
    "car la conversion de ce flux en mm n'est pas une évapotranspiration culturale crédible.",
]

ASSUMPTIONS_EN = [
    "Reference evapotranspiration is estimated with Hargreaves (T2M, T2M_MIN, T2M_MAX, latitude), not measured.",
    "Thresholds: extreme heat day above 35 °C; frost day at or below 0 °C; very heavy rain at or above 50 mm/day.",
    f"Climate fit is a fixed {int(CLIMATE_FIT_WEIGHT * 100)}% of the total score; the seven priorities share the rest.",
    "Crop trait values are indicative (0–1) and must be checked with local experts.",
    f"Scenario: +1 °C means +{int(PET_PER_DEGREE * 100)}% evapotranspiration and +{HOT_DAYS_PER_DEGREE:g} extreme heat days. "
    "This is a sensitivity test, not a climate projection.",
    "Soil class only nudges plant-available water (sand −10%, loam 0, clay +5%).",
    "Sowing windows are inferred from the average climate; local calendars can differ.",
    "The interface is French or English. Crop notes stay in French.",
    "NASA POWER EVPTRNS (energy flux, MJ/m²/day) is stored. The water balance uses Hargreaves, "
    "because converting that flux to millimetres is not a credible crop water use.",
]


@lru_cache(maxsize=32)
def _climate_cached(lat: float, lon: float, sy: int, ey: int) -> dict:
    return analyze(fetch_daily(lat, lon, sy, ey), lat)


def climate_dict(lat: float, lon: float, sy: int, ey: int) -> dict:
    lat, lon = round(lat, 2), round(lon, 2)
    notes = ["ETP estimée par Hargreaves. EVPTRNS est conservé comme flux d'énergie, pas comme lame d'eau."]
    return pack_climate(_climate_cached(lat, lon, sy, ey), lat, lon, f"{sy}-{ey}",
                        "NASA POWER (journalier, communauté AG)", False, notes)


def run_analysis(req: dict, climate: dict) -> dict:
    """req : AnalyzeRequest sous forme de dict ; climate : sortie de climate_dict / démo."""
    db = load_crops()
    rotation = req["parcel"]["current_rotation"]
    unknown = [c for c in rotation if c not in db]
    if unknown:
        raise ValueError(f"Cultures inconnues : {', '.join(unknown)}")
    lang = req.get("lang") or "fr"
    prof = build_profile(climate, req["parcel"], req["scenario"])
    out = recommend(db, prof, rotation, req["priorities"], lang=lang)
    return {"is_demo": climate["is_demo"], "summary": out["summary"], "climate_type": out["climate_type"],
            "climate": climate, "strategies": out["strategies"], "excluded_crops": out["excluded_crops"],
            "scenario": prof.scenario, "assumptions": ASSUMPTIONS_EN if lang == "en" else ASSUMPTIONS}
