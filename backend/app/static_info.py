"""Contenus statiques : sources de données utilisées et feuille de route."""

DATA_SOURCES = [
    {"source": "NASA POWER (MERRA-2)", "variable": "PRECTOTCORR", "meaning": "Précipitations corrigées (mm/jour)",
     "resolution": "environ 0,5° × 0,625°", "period": "1981 à aujourd'hui (analyse sur les années choisies)", "status": "utilisé"},
    {"source": "NASA POWER (MERRA-2)", "variable": "T2M, T2M_MIN, T2M_MAX", "meaning": "Température de l'air à 2 m (°C)",
     "resolution": "environ 0,5° × 0,625°", "period": "1981 à aujourd'hui", "status": "utilisé"},
    {"source": "NASA POWER (MERRA-2)", "variable": "RH2M", "meaning": "Humidité relative de l'air (%)",
     "resolution": "environ 0,5° × 0,625°", "period": "1981 à aujourd'hui", "status": "utilisé"},
    {"source": "NASA POWER (CERES / FLASHFlux)", "variable": "ALLSKY_SFC_SW_DWN", "meaning": "Rayonnement solaire global (kWh/m²/jour en journalier)",
     "resolution": "environ 1° × 1°", "period": "1984 à aujourd'hui", "status": "utilisé"},
    {"source": "NASA POWER (MERRA-2)", "variable": "GWETROOT, GWETTOP", "meaning": "Humidité du sol (0-1)",
     "resolution": "environ 0,5° × 0,625°", "period": "1981 à aujourd'hui", "status": "utilisé"},
    {"source": "NASA POWER (MERRA-2)", "variable": "EVPTRNS", "meaning": "Flux d'énergie d'évapotranspiration (MJ/m²/jour), archivé, non converti en mm",
     "resolution": "environ 0,5° × 0,625°", "period": "1981 à l'année précédente", "status": "archivé"},
    {"source": "Calcul interne", "variable": "ETP (Hargreaves)", "meaning": "Évapotranspiration estimée à partir de T2M, T2M_MIN, T2M_MAX et de la latitude",
     "resolution": "celle des températures", "period": "idem", "status": "calculé"},
    {"source": "OpenStreetMap Nominatim", "variable": "Recherche de lieu", "meaning": "Coordonnées d'un nom de lieu",
     "resolution": "-", "period": "-", "status": "utilisé"},
]
DATA_SOURCES_NOTE = ("Résolutions indicatives : à vérifier dans la documentation officielle de NASA POWER "
                     "(power.larc.nasa.gov).")

ROADMAP = [
    {"id": "smap", "name": "SMAP", "role": "Humidité du sol mesurée par satellite, pour affiner le stress hydrique par parcelle."},
    {"id": "gpm_imerg", "name": "GPM / IMERG", "role": "Précipitations quasi temps réel et à fine résolution."},
    {"id": "ndvi", "name": "MODIS / Landsat (NDVI)", "role": "Santé de la végétation, suivi de la couverture du sol et des rotations passées."},
    {"id": "ecostress", "name": "ECOSTRESS", "role": "Stress hydrique des plantes via la température de surface."},
    {"id": "grace", "name": "GRACE", "role": "Variations des eaux souterraines, pour la disponibilité de l'eau d'irrigation."},
]
for r in ROADMAP:
    r["status"] = "planned"
