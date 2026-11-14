"""Client NASA POWER (données journalières, communauté AG) avec cache fichier."""
import json
import os
from pathlib import Path

import pandas as pd
import requests

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
# Communauté AG. EVPTRNS est un flux d'énergie (pas des mm) : il est archivé,
# le bilan hydrique utilise Hargreaves. Voir README.
PARAMS = ["PRECTOTCORR", "T2M", "T2M_MIN", "T2M_MAX", "RH2M",
          "ALLSKY_SFC_SW_DWN", "EVPTRNS", "GWETROOT", "GWETTOP"]


def _cache_path(lat: float, lon: float, start: int, end: int) -> Path:
    cache_dir = Path(os.getenv("CACHE_DIR", "backend/cache"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"power_{lat:.2f}_{lon:.2f}_{start}_{end}.json"


def fetch_payload(lat: float, lon: float, start_year: int, end_year: int) -> dict:
    """Réponse JSON brute de NASA POWER (avec cache fichier)."""
    path = _cache_path(lat, lon, start_year, end_year)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    resp = requests.get(POWER_URL, params={
        "parameters": ",".join(PARAMS),
        "community": "AG",
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "start": f"{start_year}0101",
        "end": f"{end_year}1231",
        "format": "JSON",
    }, timeout=180)
    resp.raise_for_status()
    payload = resp.json()
    path.write_text(json.dumps(payload), encoding="utf-8")
    return payload


def payload_to_df(payload: dict) -> pd.DataFrame:
    """DataFrame journalier indexé par date (valeurs -999 -> NaN)."""
    data = payload["properties"]["parameter"]
    df = pd.DataFrame({k: pd.Series(v) for k, v in data.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    return df.replace(-999, float("nan")).sort_index()


def fetch_daily(lat: float, lon: float, start_year: int, end_year: int) -> pd.DataFrame:
    return payload_to_df(fetch_payload(lat, lon, start_year, end_year))
