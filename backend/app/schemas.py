from pydantic import BaseModel, Field
from typing import Literal


class ClimateRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    start_year: int = Field(default=2011, ge=1990)
    end_year: int = Field(default=2025, le=2026)


class MonthlyRecord(BaseModel):
    year: int
    month: int
    precip_mm: float | None
    t2m: float | None
    t2m_min: float | None
    t2m_max: float | None
    rh2m: float | None
    solar: float | None
    pet_mm: float | None
    evptrns_mj: float | None = None
    soil_wetness_root: float | None
    soil_wetness_top: float | None = None


class WaterBalanceMonth(BaseModel):
    month: int
    precip_mm: float
    pet_mm: float
    p_minus_pet_mm: float
    klass: Literal["dry", "humid", "neutral"]


class ClimateResponse(BaseModel):
    source: str
    is_demo: bool
    pet_method: str = "hargreaves"
    lat: float
    lon: float
    period: str
    climate_type: str = ""
    monthly: list[MonthlyRecord]
    climatology: list[dict] = []
    trends: dict
    anomalies: list[dict]
    anomalies_annual: list[dict] = []
    extremes: dict
    water_balance: list[WaterBalanceMonth]
    season: dict
    interannual_cv: dict
    notes: list[str]


# --------------------------------------------------------------------------- analyse
class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class Parcel(BaseModel):
    current_rotation: list[str] = Field(min_length=1, max_length=6)
    soil: Literal["sandy", "loam", "clay"] = "loam"
    slope: Literal["flat", "moderate", "steep"] = "flat"
    irrigation: bool = False
    rainy_seasons: Literal[1, 2] = 1


class Priorities(BaseModel):
    water: float = Field(default=5, ge=0, le=10)
    erosion: float = Field(default=5, ge=0, le=10)
    organic_matter: float = Field(default=5, ge=0, le=10)
    nitrogen: float = Field(default=5, ge=0, le=10)
    income: float = Field(default=5, ge=0, le=10)
    pest_break: float = Field(default=5, ge=0, le=10)
    fodder: float = Field(default=5, ge=0, le=10)


class Scenario(BaseModel):
    precip_delta_pct: float = Field(default=0, ge=-60, le=60)
    temp_delta_c: float = Field(default=0, ge=-5, le=5)


class AnalyzeRequest(BaseModel):
    location: Location
    parcel: Parcel
    priorities: Priorities = Priorities()
    scenario: Scenario = Scenario()
    lang: Literal["fr", "en"] = "fr"   # textes générés en français pour l'instant
    start_year: int = Field(default=2011, ge=1990)
    end_year: int = Field(default=2025, le=2026)


class Strategy(BaseModel):
    id: str
    name: str
    is_baseline: bool
    sequence: list[str]
    sequence_names: list[str]
    total_score: float
    criteria_scores: dict[str, float]
    breakdown: list[dict]
    climate_fit: float
    why: str
    evidence: list[dict]
    benefits: list[str]
    info_gaps: list[str]
    local_risks: list[str]
    confidence: Literal["faible", "moyen", "élevé"]
    confidence_label: str
    confidence_code: Literal["low", "medium", "high"] = "medium"
    timeline: list[dict]


class AnalyzeResponse(BaseModel):
    is_demo: bool
    summary: list[str]
    climate_type: str
    climate: ClimateResponse
    strategies: list[Strategy]
    excluded_crops: list[dict]
    scenario: dict
    assumptions: list[str]
