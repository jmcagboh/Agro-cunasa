"""Moteur de recommandation explicable (sans boîte noire).

Principe :
1. Un profil climatique mensuel (issu de NASA POWER, ajusté par le scénario) est construit.
2. Chaque culture est testée sur toutes les fenêtres de semis possibles : compatibilité
   chaleur / température / gel / eau. Résultat : cultures compatibles + fenêtre + indice d'adaptation.
3. Des rotations sont générées et notées sur 7 critères (0-1), pondérés par les priorités
   de l'utilisateur. Un critère fixe « adaptation climatique » (CLIMATE_FIT_WEIGHT) s'y ajoute.
4. Chaque score est décomposé critère par critère (breakdown).
"""
from __future__ import annotations

import itertools
import math
from collections import Counter
from dataclasses import dataclass, field
from statistics import mean

PRIORITY_KEYS = ["water", "erosion", "organic_matter", "nitrogen", "income", "pest_break", "fodder"]
LABELS_FR = {
    "water": "économie d’eau", "erosion": "protection contre l’érosion", "organic_matter": "matière organique",
    "nitrogen": "fixation d’azote", "income": "revenu / marché", "pest_break": "rupture du cycle des ravageurs",
    "fodder": "valeur fourragère",
}
MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
             "septembre", "octobre", "novembre", "décembre"]
CLIMATE_LABELS_FR = {"tropical_bimodal": "tropical à deux saisons des pluies", "tropical_unimodal": "tropical à une saison des pluies",
                     "semi_arid": "semi-aride", "temperate": "tempéré"}
CLIMATE_LABELS_EN = {"tropical_bimodal": "tropical with two rainy seasons", "tropical_unimodal": "tropical with one rainy season",
                     "semi_arid": "semi-arid", "temperate": "temperate"}
STRATEGY_NAMES = {
    "fr": {"baseline": "Rotation actuelle (référence)", "balanced": "Équilibrée selon vos priorités",
           "resilient": "Résiliente au climat", "soil": "Sol vivant (matière organique, azote, couverture)"},
    "en": {"baseline": "Current rotation (reference)", "balanced": "Balanced to your priorities",
           "resilient": "Climate-resilient", "soil": "Living soil (organic matter, nitrogen, cover)"},
}

CLIMATE_FIT_WEIGHT = 0.25      # poids fixe du critère « adaptation climatique » dans le score total
FROST_SAFE_C = 4.0             # T° minimale moyenne mensuelle sous laquelle une culture sensible au gel est exclue
SOIL_WATER_FACTOR = {"sandy": 0.9, "loam": 1.0, "clay": 1.05}   # rétention d'eau approximative
PET_PER_DEGREE = 0.04          # +4 % d'ETP par °C (sensibilité simplifiée, pas une projection)
HOT_DAYS_PER_DEGREE = 6.0      # +6 jours de chaleur extrême par °C (sensibilité simplifiée)
FROST_CHANGE_PER_DEGREE = 0.2  # -20 % de risque de gel par °C (sensibilité simplifiée)
POOL_SIZE = 12
REASONS_FR = {
    "chaleur": "trop de jours de chaleur extrême", "trop froid": "température moyenne du cycle trop basse",
    "trop chaud": "température moyenne du cycle trop élevée", "gel": "risque de gel pendant le cycle",
    "eau insuffisante": "pluie insuffisante sur le cycle (sans irrigation)",
}
REASONS_EN = {
    "chaleur": "too many extreme heat days", "trop froid": "average temperature over the cycle is too low",
    "trop chaud": "average temperature over the cycle is too high", "gel": "frost risk during the cycle",
    "eau insuffisante": "not enough rain over the cycle (no irrigation)",
}


@dataclass
class Profile:
    precip: list           # mm/mois, 12 valeurs (moyenne interannuelle, scénario appliqué)
    pet: list              # mm/mois
    tmean: list            # °C
    tmin: list             # °C (moyenne des minima journaliers)
    tmax: list             # °C
    soil_wetness: list     # 0-1 ou None
    hot_days: float
    frost_risk_pct: float
    cv_precip: float | None
    n_years: int
    irrigated: bool = False
    soil: str = "loam"
    slope: str = "flat"
    rainy_seasons: int = 1
    scenario: dict = field(default_factory=dict)

    @property
    def annual_precip(self) -> float:
        return sum(self.precip)

    @property
    def annual_temp(self) -> float:
        return mean(self.tmean)

    @property
    def climate_type(self) -> str:
        if self.frost_risk_pct >= 30 or self.annual_temp < 14:
            return "temperate"
        if self.annual_precip < 500:
            return "semi_arid"
        return "tropical_bimodal" if self.rainy_seasons == 2 else "tropical_unimodal"


# ----------------------------------------------------------------------------- profil
def _monthly_clim(monthly: list[dict], key: str) -> list:
    acc = [[] for _ in range(12)]
    for r in monthly:
        v = r.get(key)
        if v is not None and not (isinstance(v, float) and math.isnan(v)):
            acc[r["month"] - 1].append(v)
    return [sum(a) / len(a) if a else None for a in acc]


def build_profile(climate: dict, parcel: dict, scenario: dict | None = None) -> Profile:
    """Construit le profil climatique mensuel moyen puis applique le scénario (± pluie, ± température)."""
    scenario = scenario or {}
    dp, dt = float(scenario.get("precip_delta_pct", 0) or 0), float(scenario.get("temp_delta_c", 0) or 0)
    m = climate["monthly"]
    precip, pet = _monthly_clim(m, "precip_mm"), _monthly_clim(m, "pet_mm")
    tmean, tmin, tmax = _monthly_clim(m, "t2m"), _monthly_clim(m, "t2m_min"), _monthly_clim(m, "t2m_max")
    if any(v is None for v in precip + pet + tmean + tmin + tmax):
        raise ValueError("Données climatiques insuffisantes pour construire un profil mensuel.")
    ext = climate["extremes"]
    return Profile(
        precip=[p * (1 + dp / 100) for p in precip],
        pet=[e * (1 + PET_PER_DEGREE * dt) for e in pet],
        tmean=[t + dt for t in tmean], tmin=[t + dt for t in tmin], tmax=[t + dt for t in tmax],
        soil_wetness=_monthly_clim(m, "soil_wetness_root"),
        hot_days=max(0.0, ext["hot_days_avg"] + HOT_DAYS_PER_DEGREE * dt),
        frost_risk_pct=min(100.0, max(0.0, ext["frost_risk_pct"] * (1 - FROST_CHANGE_PER_DEGREE * dt))),
        cv_precip=(climate.get("interannual_cv") or {}).get("precip"),
        n_years=len({r["year"] for r in m}),
        irrigated=bool(parcel.get("irrigation", False)), soil=parcel.get("soil", "loam"),
        slope=parcel.get("slope", "flat"), rainy_seasons=int(parcel.get("rainy_seasons", 1)),
        scenario={"precip_delta_pct": dp, "temp_delta_c": dt},
    )


# ----------------------------------------------------------------------------- compatibilité d'une culture
def crop_fit(crop: dict, prof: Profile) -> dict:
    """Teste toutes les fenêtres de semis ; retourne la meilleure fenêtre et un indice d'adaptation (0-1)."""
    n = int(crop["cycle_months"])
    soil_f = SOIL_WATER_FACTOR.get(prof.soil, 1.0)
    allowed_hot = 10 + 90 * crop["heat_tol"]
    heat_ok = prof.hot_days <= allowed_hot
    best, fails = None, Counter()
    for start in range(12):
        idx = [(start + i) % 12 for i in range(n)]
        p = sum(prof.precip[i] for i in idx) * soil_f
        t = mean(prof.tmean[i] for i in idx)
        reasons = []
        if not heat_ok:
            reasons.append("chaleur")
        if t < crop["t_mean_min"]:
            reasons.append("trop froid")
        elif t > crop["t_mean_max"]:
            reasons.append("trop chaud")
        if crop["frost_tol"] < 0.4 and min(prof.tmin[i] for i in idx) < FROST_SAFE_C:
            reasons.append("gel")
        if not prof.irrigated and p < crop["water_min_mm"]:
            reasons.append("eau insuffisante")
        if reasons:
            fails[reasons[0]] += 1
            continue
        ratio = min(1.0, p / crop["water_opt_mm"])
        if prof.irrigated:
            ratio = max(ratio, 0.9)
        if best is None or ratio > best["water_ratio"]:
            best = {"start": start, "idx": idx, "precip_mm": p, "water_ratio": ratio, "temp": t}
    if best is None:
        return {"ok": False, "fit": 0.15, "reason": fails.most_common(1)[0][0], "window_start": None,
                "months": [], "precip_mm": None, "water_ratio": None, "vulnerable_months": [], "mean_temp": None}
    fit = 0.5 + 0.5 * best["water_ratio"]
    if prof.hot_days > 0.6 * allowed_hot:
        fit -= 0.1
    vulnerable = sorted({
        i + 1 for i in best["idx"]
        if (not prof.irrigated and crop["drought_tol"] < 0.6 and prof.precip[i] < 0.5 * prof.pet[i])
        or (crop["heat_tol"] < 0.7 and prof.tmax[i] > 36)})
    return {"ok": True, "fit": round(max(0.0, fit), 3), "reason": None, "window_start": best["start"] + 1,
            "months": [i + 1 for i in best["idx"]], "precip_mm": best["precip_mm"],
            "water_ratio": best["water_ratio"], "vulnerable_months": vulnerable, "mean_temp": best["temp"]}


# ----------------------------------------------------------------------------- notation d'une rotation
def criteria(crops: list[dict]) -> dict:
    n = len(crops)
    avg = lambda f: sum(f(c) for c in crops) / n
    has_cover = any(c["group"] == "cover_legume" for c in crops)
    nfix = [c["n_fixation"] for c in crops]
    return {
        "water": avg(lambda c: 0.6 * (1 - min(1.0, c["water_opt_mm"] / 1200)) + 0.4 * c["drought_tol"]),
        "erosion": min(1.0, avg(lambda c: 0.6 * c["soil_cover"] + 0.4 * c["rooting"]) + (0.08 if has_cover else 0)),
        "organic_matter": avg(lambda c: c["organic_matter"]),
        "nitrogen": 0.5 * mean(nfix) + 0.5 * max(nfix),
        "income": avg(lambda c: c["market"]),
        "pest_break": 0.5 * len({c["family"] for c in crops}) / n + 0.5 * avg(lambda c: c["pest_break"]),
        "fodder": avg(lambda c: c["fodder"]),
    }


def normalize_weights(priorities: dict) -> dict:
    w = {k: max(0.0, float(priorities.get(k, 5))) for k in PRIORITY_KEYS}
    if sum(w.values()) == 0:
        w = {k: 1.0 for k in PRIORITY_KEYS}
    return w


def score_rotation(db: dict, seq: list[str], fits: dict, weights: dict) -> dict:
    crit = criteria([db[c] for c in seq])
    fit_mean = mean(fits[c]["fit"] for c in seq)
    wsum = sum(weights.values())
    k = 1 - CLIMATE_FIT_WEIGHT
    weighted = sum(weights[c] * crit[c] for c in PRIORITY_KEYS) / wsum
    total = k * weighted + CLIMATE_FIT_WEIGHT * fit_mean
    breakdown = [{"criterion": c, "label": LABELS_FR[c], "score": round(crit[c], 3),
                  "weight_pct": round(100 * k * weights[c] / wsum, 1),
                  "contribution": round(100 * k * weights[c] / wsum * crit[c], 2)} for c in PRIORITY_KEYS]
    breakdown.append({"criterion": "climate_fit", "label": "adaptation au climat", "score": round(fit_mean, 3),
                      "weight_pct": round(100 * CLIMATE_FIT_WEIGHT, 1),
                      "contribution": round(100 * CLIMATE_FIT_WEIGHT * fit_mean, 2)})
    return {"total": total, "criteria": crit, "climate_fit": fit_mean, "breakdown": breakdown}


# ----------------------------------------------------------------------------- confiance
def confidence_level(prof: Profile, seq: list[str], fits: dict) -> str:
    cv = prof.cv_precip
    level = 0 if cv is None else 2 if cv < 0.15 else 1 if cv < 0.25 else 0
    if prof.n_years < 8:
        level = 0
    elif prof.n_years < 10:
        level = min(level, 1)
    if any(fits[c]["fit"] < 0.5 for c in seq):
        level = max(0, level - 1)
    return ["low", "medium", "high"][level]


CONF_LABEL_FR = {"low": "faible", "medium": "moyen", "high": "élevé"}


# ----------------------------------------------------------------------------- génération
def _family_clash(db, combo) -> bool:
    return any(db[combo[i]]["family"] == db[combo[(i + 1) % len(combo)]]["family"] for i in range(len(combo)))


def _canonical(combo) -> bool:
    return tuple(combo) == min(tuple(combo[i:] + combo[:i]) for i in range(len(combo)))


def _describe(db, prof, seq, fits, sc, base_sc, is_baseline, weights, lang: str = "fr") -> dict:
    en = lang == "en"
    name_key = "name_en" if en else "name_fr"
    reasons = REASONS_EN if en else REASONS_FR
    labels = {
        "water": "water saving", "erosion": "erosion protection", "organic_matter": "organic matter",
        "nitrogen": "nitrogen fixation", "income": "income / market", "pest_break": "pest-cycle break",
        "fodder": "fodder value",
    } if en else LABELS_FR
    months = ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"] if en else MONTHS_FR
    names = [db[c][name_key] for c in seq]
    top_deltas = sorted(((sc["criteria"][k] - base_sc["criteria"][k], k) for k in PRIORITY_KEYS if weights[k] > 0), reverse=True)
    gains = [(d, k) for d, k in top_deltas if d > 0.03][:2]
    if is_baseline:
        why = ("Your current rotation, used as the comparison baseline." if en
               else "Votre rotation actuelle, utilisée comme référence de comparaison.")
        benefits = [f"{db[c][name_key]} : {db[c]['notes_fr']}" for c in dict.fromkeys(seq)]
    else:
        if gains:
            joined = (" and " if en else " et ").join(f"{labels[k]} (+{round(d * 100)})" for d, k in gains)
            why = (f"Suggested because it mainly improves: {joined}." if en
                   else f"Proposée car elle améliore surtout : {joined}.")
        else:
            why = ("Suggested as an option that fits the climate and your priorities." if en
                   else "Proposée comme alternative cohérente avec le climat et vos priorités.")
        better = "Better" if en else "Meilleure"
        than = "than the current rotation" if en else "que la rotation actuelle"
        benefits = [f"{better} {labels[k]} {than} (+{round(d * 100)})" for d, k in gains]
        benefits += [f"{db[c][name_key]} : {db[c]['notes_fr']}" for c in dict.fromkeys(seq)][:3]

    evidence, risks, timeline = [], [], []
    for c in dict.fromkeys(seq):
        f, cr = fits[c], db[c]
        cname = cr[name_key]
        if f["ok"]:
            if en:
                finding = (f"Average rain over the {cname} cycle (window starting {months[f['window_start'] - 1]}, "
                           f"{cr['cycle_months']} months): {round(f['precip_mm'])} mm, versus a need of about "
                           f"{cr['water_min_mm']} to {cr['water_opt_mm']} mm.")
            else:
                finding = (f"Pluie moyenne sur le cycle du {cname.lower()} (fenêtre {months[f['window_start'] - 1]}, "
                           f"{cr['cycle_months']} mois) : {round(f['precip_mm'])} mm, pour un besoin d’environ "
                           f"{cr['water_min_mm']} à {cr['water_opt_mm']} mm.")
            evidence.append({"variable": "PRECTOTCORR", "finding": finding})
            sw = [prof.soil_wetness[m - 1] for m in f["months"] if prof.soil_wetness[m - 1] is not None]
            if sw:
                wet = round(mean(sw), 2)
                evidence.append({"variable": "GWETROOT", "finding": (
                    f"Average root-zone soil wetness over this window: {wet} (scale 0 to 1)." if en
                    else f"Humidité moyenne du sol racinaire sur cette fenêtre : {wet} (échelle 0 à 1).")})
        else:
            risks.append(f"{cname} : " + (
                f"a poor fit for the modelled climate ({reasons[f['reason']]})." if en
                else f"peu adapté au climat modélisé ({reasons[f['reason']]})."))
        if f["vulnerable_months"]:
            listed = ", ".join(months[m - 1] for m in f["vulnerable_months"])
            risks.append(f"{cname} : " + (
                f"likely vulnerable months ({listed})." if en else f"mois de vulnérabilité probables ({listed})."))
        timeline.append({"crop": c, "crop_name": cname, "ok": f["ok"], "months": f["months"],
                         "vulnerable_months": f["vulnerable_months"]})
    evidence.append({"variable": "T2M_MAX", "finding": (
        f"On average {round(prof.hot_days, 1)} days per year above 35 °C." if en
        else f"En moyenne {round(prof.hot_days, 1)} jours par an au-dessus de 35 °C.")})
    if any(db[c]["frost_tol"] < 0.4 for c in seq) or prof.frost_risk_pct > 0:
        evidence.append({"variable": "T2M_MIN", "finding": (
            f"A day at or below 2 °C occurred in {round(prof.frost_risk_pct)}% of years." if en
            else f"Gel (≤ 2 °C) observé au moins un jour dans {round(prof.frost_risk_pct)} % des années.")})
    evidence.append({"variable": "ETP (Hargreaves)", "finding": (
        "Evapotranspiration estimated with the Hargreaves method from air temperature." if en
        else "Évapotranspiration estimée par la méthode de Hargreaves à partir des températures.")})
    if len({db[c]["family"] for c in seq}) < len(seq):
        risks.append("Several crops from the same family: shared pest and disease risk." if en
                     else "Plusieurs cultures de la même famille : risque de maladies et ravageurs communs.")
    if prof.slope == "steep" and sc["criteria"]["erosion"] < 0.7:
        risks.append("Steep field: soil cover looks too weak. Check erosion on site." if en
                     else "Parcelle en forte pente : la protection du sol est insuffisante, risque d’érosion à vérifier sur place.")
    if prof.soil == "sandy":
        risks.append("Sandy soil holds little water and nutrients. Confirm with what you see in the field." if en
                     else "Sol sableux : retient peu l’eau et les nutriments ; à valider avec l’observation locale du sol.")
    if prof.cv_precip is not None and prof.cv_precip >= 0.25:
        risks.append("Rainfall varies a lot from year to year: keep a safety margin." if en
                     else "Pluies très variables d’une année à l’autre : prévoir des marges de sécurité.")
    gaps = ([
        "Real soil texture, pH and organic matter (a field test).",
        "Local prices, buyers and market access.",
        "Varieties and seed actually available nearby.",
        "Real pest and disease pressure in this area.",
    ] if en else [
        "Texture, pH et matière organique réels du sol (analyse de terrain).",
        "Prix locaux, débouchés et accès au marché.",
        "Variétés et semences disponibles localement.",
        "Pression réelle des maladies et ravageurs sur la zone.",
    ])
    if prof.irrigated:
        gaps.append("Irrigation water availability and cost." if en else "Disponibilité et coût de l’eau d’irrigation.")
    conf = confidence_level(prof, seq, fits)
    return {"sequence": list(seq), "sequence_names": names, "total_score": round(sc["total"], 3),
            "criteria_scores": {k: round(v, 3) for k, v in sc["criteria"].items()} | {"climate_fit": round(sc["climate_fit"], 3)},
            "breakdown": sc["breakdown"], "climate_fit": round(sc["climate_fit"], 3), "why": why,
            "evidence": evidence, "benefits": benefits, "info_gaps": gaps, "local_risks": risks,
            "confidence": CONF_LABEL_FR[conf], "confidence_label": CONF_LABEL_FR[conf],
            "confidence_code": conf, "timeline": timeline}


def recommend(db: dict, prof: Profile, baseline: list[str], priorities: dict, lang: str = "fr") -> dict:
    weights = normalize_weights(priorities)
    fits = {cid: crop_fit(c, prof) for cid, c in db.items()}
    base_sc = score_rotation(db, baseline, fits, weights)
    names = STRATEGY_NAMES["en" if lang == "en" else "fr"]
    strategies = [{"id": "baseline", "name": names["baseline"], "is_baseline": True,
                   **_describe(db, prof, baseline, fits, base_sc, base_sc, True, weights, lang)}]

    ok_ids = [c for c, f in fits.items() if f["ok"]]
    L = min(4, max(3, len(baseline)))
    L = min(L, len(ok_ids))
    if L >= 2:
        single = {c: score_rotation(db, [c], fits, weights)["total"] for c in ok_ids}
        pool = sorted(ok_ids, key=lambda c: -single[c])[:POOL_SIZE]
        cands = []
        for combo in itertools.permutations(pool, L):
            combo = list(combo)
            if _family_clash(db, combo) or not _canonical(combo):
                continue
            sc = score_rotation(db, combo, fits, weights)
            water = sc["criteria"]["water"]
            soil = mean([sc["criteria"]["organic_matter"], sc["criteria"]["nitrogen"], sc["criteria"]["erosion"]])
            cands.append((combo, sc, {"balanced": sc["total"], "resilient": 0.5 * sc["climate_fit"] + 0.5 * water, "soil": soil}))
        used = {frozenset(baseline)}
        for sid, key in [("balanced", "balanced"), ("resilient", "resilient"), ("soil", "soil")]:
            pick = [x for x in sorted(cands, key=lambda x: -x[2][key]) if frozenset(x[0]) not in used]
            if pick:
                combo, sc, _ = pick[0]
                used.add(frozenset(combo))
                strategies.append({"id": sid, "name": names[sid], "is_baseline": False,
                                   **_describe(db, prof, combo, fits, sc, base_sc, False, weights, lang)})

    reason_labels = REASONS_EN if lang == "en" else REASONS_FR
    excluded = [{"id": c, "crop": c, "name": db[c]["name_en" if lang == "en" else "name_fr"],
                 "reason": reason_labels[f["reason"]]} for c, f in fits.items() if not f["ok"]]
    alts = [s for s in strategies if not s["is_baseline"]]
    best = max(alts, key=lambda s: s["total_score"]) if alts else None
    return {"strategies": strategies, "excluded_crops": excluded, "climate_type": prof.climate_type,
            "summary": build_summary(prof, strategies[0], best, climate_period=None, lang=lang),
            "crop_fits": {c: {"ok": f["ok"], "fit": f["fit"], "window_start": f["window_start"]} for c, f in fits.items()}}


def build_summary(prof: Profile, baseline: dict, best: dict | None, climate_period: str | None,
                  season: dict | None = None, lang: str = "fr") -> list[str]:
    en = lang == "en"
    climate = (CLIMATE_LABELS_EN if en else CLIMATE_LABELS_FR)[prof.climate_type]
    rain, temp = round(prof.annual_precip), prof.annual_temp
    if en:
        s1 = f"This place receives about {rain} mm of rain a year and averages {temp:.1f} °C ({climate} climate)."
    else:
        s1 = f"Ce lieu reçoit en moyenne {rain} mm de pluie par an pour {temp:.1f} °C (climat {climate})."
    if best and best["total_score"] > baseline["total_score"]:
        alt = " → ".join(best["sequence_names"])
        b100, a100 = round(baseline["total_score"] * 100), round(best["total_score"] * 100)
        s2 = (f"“{best['name']}” ({alt}) scores {a100}/100 against {b100}/100 for your current rotation, using your priorities."
              if en else
              f"La stratégie « {best['name']} » ({alt}) obtient {a100}/100 contre {b100}/100 pour votre rotation actuelle, selon vos priorités.")
    else:
        b100 = round(baseline["total_score"] * 100)
        s2 = (f"Your current rotation scores {b100}/100 and stays competitive with the options tested." if en
              else f"Votre rotation actuelle obtient {b100}/100 et reste compétitive face aux alternatives testées.")
    conf = {"low": "low", "medium": "medium", "high": "high"}.get(baseline.get("confidence_code"), baseline["confidence_label"])
    if not en:
        conf = baseline["confidence_label"]
    s3 = (f"Confidence is {conf} (rainfall variability over {prof.n_years} years). "
          "These results help compare options and should be checked with a local farm adviser."
          if en else
          f"Niveau de confiance {conf} (variabilité des pluies sur {prof.n_years} ans) : "
          "ces résultats aident à comparer des options et doivent être validés avec un conseiller agricole local.")
    return [s1, s2, s3]
