"""Chargement de la base de connaissances des cultures (data/crops.json)."""
import functools
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@functools.lru_cache(maxsize=1)
def load_crops_doc() -> dict:
    return json.loads((DATA_DIR / "crops.json").read_text(encoding="utf-8"))


def load_crops() -> dict[str, dict]:
    return {c["id"]: c for c in load_crops_doc()["crops"]}
