import os

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from . import service  # noqa: E402
from .auth import router as auth_router  # noqa: E402
from .knowledge import load_crops_doc  # noqa: E402
from .schemas import AnalyzeRequest, AnalyzeResponse, ClimateRequest, ClimateResponse  # noqa: E402
from .static_info import DATA_SOURCES, DATA_SOURCES_NOTE, ROADMAP  # noqa: E402

app = FastAPI(title="TerraShift API", version="0.3.0")
app.include_router(auth_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://jmcagboh.github.io",
    ).split(",") if item.strip()],
    allow_methods=["*"], allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "terrashift"}


@app.post("/api/climate", response_model=ClimateResponse)
def climate(req: ClimateRequest):
    if req.end_year < req.start_year:
        raise HTTPException(400, "end_year doit être >= start_year")
    try:
        return service.climate_dict(req.lat, req.lon, req.start_year, req.end_year)
    except requests.RequestException as e:
        raise HTTPException(502, f"NASA POWER indisponible : {e}")


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_endpoint(req: AnalyzeRequest):
    if req.end_year < req.start_year:
        raise HTTPException(400, "end_year doit être >= start_year")
    try:
        clim = service.climate_dict(req.location.lat, req.location.lon, req.start_year, req.end_year)
        return service.run_analysis(req.model_dump(), clim)
    except requests.RequestException as e:
        raise HTTPException(502, f"NASA POWER indisponible : {e}")
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.get("/api/crops")
def crops():
    return load_crops_doc()["crops"]


@app.get("/api/data-sources")
def data_sources():
    return {"note": DATA_SOURCES_NOTE, "sources": DATA_SOURCES}


@app.get("/api/roadmap")
def roadmap():
    return ROADMAP


@app.get("/api/geocode")
def geocode(q: str):
    ua = os.getenv("NOMINATIM_USER_AGENT", "TerraShift/0.3")
    try:
        r = requests.get("https://nominatim.openstreetmap.org/search",
                         params={"q": q, "format": "json", "limit": 5},
                         headers={"User-Agent": ua}, timeout=15)
        r.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(502, f"Géocodage indisponible : {e}")
    return [{"name": x["display_name"], "lat": float(x["lat"]), "lon": float(x["lon"])} for x in r.json()]
