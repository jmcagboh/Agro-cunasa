"""Télécharge UNE FOIS les vraies données NASA POWER pour Lomé et les range dans data/demo/.
Usage (depuis la racine du projet, avec internet) :  python scripts/prepare_demo.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.app.demo import DEMO_FILE, LOME  # noqa: E402
from backend.app.power_client import fetch_payload  # noqa: E402

payload = fetch_payload(LOME["lat"], LOME["lon"], 2011, 2025)
DEMO_FILE.parent.mkdir(parents=True, exist_ok=True)
DEMO_FILE.write_text(json.dumps(payload), encoding="utf-8")
print("Cache de démo écrit :", DEMO_FILE)
