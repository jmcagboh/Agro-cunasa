"""Mode démo : parcelle préchargée à Lomé (Togo), sans dépendre du réseau.

1. Si data/demo/lome_power.json existe (créé par scripts/prepare_demo.py), il contient de VRAIES
   données NASA POWER en cache : la démo est instantanée et marquée « cache démo ».
2. Sinon, un jeu SYNTHÉTIQUE étiqueté « DÉMO » est utilisé : ce ne sont PAS des données NASA.
"""
import json
from functools import lru_cache

import numpy as np
import pandas as pd

from .climate import analyze
from .knowledge import DATA_DIR
from .power_client import payload_to_df

LOME = {"lat": 6.13, "lon": 1.22}
DEMO_FILE = DATA_DIR / "demo" / "lome_power.json"
DEMO_REQUEST = {
    "location": LOME,
    "parcel": {"current_rotation": ["maize", "cassava"], "soil": "sandy", "slope": "moderate",
               "irrigation": False, "rainy_seasons": 2},
    "priorities": {"water": 7, "erosion": 5, "organic_matter": 8, "nitrogen": 9, "income": 6, "pest_break": 5, "fodder": 2},
    "scenario": {"precip_delta_pct": 0, "temp_delta_c": 0},
}
_MONTH_P = [20, 35, 60, 100, 140, 200, 100, 40, 70, 90, 30, 15]   # mm/mois, ordre de grandeur côtier


def _synthetic_df() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    idx = pd.date_range("2011-01-01", "2025-12-31")
    doy = idx.day_of_year.to_numpy()
    mean_p = np.array([_MONTH_P[m - 1] / pd.Period(f"2021-{m:02d}").days_in_month for m in idx.month])
    precip = mean_p * rng.gamma(0.4, 2.5, len(idx))
    t = 27 + 1.8 * np.sin((doy - 30) / 365 * 2 * np.pi * 2 + 0.5)
    wet = np.clip(precip / 15, 0, 1)
    return pd.DataFrame({"PRECTOTCORR": precip, "T2M": t, "T2M_MIN": t - 3.0, "T2M_MAX": t + 3.5, "RH2M": 78.0,
                         "ALLSKY_SFC_SW_DWN": 5.2, "GWETROOT": 0.35 + 0.3 * wet, "GWETTOP": 0.3 + 0.4 * wet}, index=idx)


@lru_cache(maxsize=1)
def demo_climate() -> dict:
    if DEMO_FILE.exists():
        df = payload_to_df(json.loads(DEMO_FILE.read_text(encoding="utf-8")))
        source, notes = "NASA POWER (cache démo, Lomé)", ["Données NASA POWER réelles, chargées depuis le cache de démonstration."]
    else:
        df = _synthetic_df()
        source = "DÉMO : données synthétiques (non NASA)"
        notes = ["ATTENTION : jeu de données synthétique de démonstration, NON issu de la NASA. "
                 "Lancez scripts/prepare_demo.py pour utiliser de vraies données NASA POWER en cache."]
    y0, y1 = int(df.index.year.min()), int(df.index.year.max())
    from .service import pack_climate
    notes = notes + ["ETP estimée par Hargreaves. EVPTRNS, s'il est présent, reste un flux d'énergie."]
    return pack_climate(analyze(df, LOME["lat"]), LOME["lat"], LOME["lon"], f"{y0}-{y1}", source, True, notes)
