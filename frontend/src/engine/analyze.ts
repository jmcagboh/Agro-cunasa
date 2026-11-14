import cropsDoc from "../../../data/crops.json";
import type { Analyze, Crop, Lang, Parcel, Priorities, Scenario } from "../api";

type CropRow = Crop & {
  family: string;
  cycle_months: number;
  water_min_mm: number;
  water_opt_mm: number;
  t_mean_min: number;
  t_mean_max: number;
  drought_tol: number;
  frost_tol: number;
  heat_tol: number;
  n_fixation: number;
  rooting: number;
  organic_matter: number;
  soil_cover: number;
  pest_break: number;
  fodder: number;
  market: number;
  notes_fr: string;
};

const CROPS = cropsDoc.crops as CropRow[];
const DB: Record<string, CropRow> = Object.fromEntries(CROPS.map((crop) => [crop.id, crop]));

const KEYS = ["water", "erosion", "organic_matter", "nitrogen", "income", "pest_break", "fodder"] as const;
const FIT_WEIGHT = 0.25;
const FROST_SAFE = 4;
const SOIL_F: Record<string, number> = { sandy: 0.9, loam: 1, clay: 1.05 };
const PET_PER_C = 0.04;
const HOT_PER_C = 6;
const MONTHS = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};
const LABELS = {
  fr: { water: "économie d’eau", erosion: "protection contre l’érosion", organic_matter: "matière organique", nitrogen: "fixation d’azote", income: "revenu / marché", pest_break: "rupture du cycle des ravageurs", fodder: "valeur fourragère" },
  en: { water: "water saving", erosion: "erosion protection", organic_matter: "organic matter", nitrogen: "nitrogen fixation", income: "income / market", pest_break: "pest-cycle break", fodder: "fodder value" },
};
const CLIMATE_NAME = {
  fr: { tropical_bimodal: "tropical à deux saisons des pluies", tropical_unimodal: "tropical à une saison des pluies", semi_arid: "semi-aride", temperate: "tempéré" },
  en: { tropical_bimodal: "tropical with two rainy seasons", tropical_unimodal: "tropical with one rainy season", semi_arid: "semi-arid", temperate: "temperate" },
};
const NAMES = {
  fr: { baseline: "Rotation actuelle (référence)", balanced: "Équilibrée selon vos priorités", resilient: "Résiliente au climat", soil: "Sol vivant (matière organique, azote, couverture)" },
  en: { baseline: "Current rotation (reference)", balanced: "Balanced to your priorities", resilient: "Climate-resilient", soil: "Living soil (organic matter, nitrogen, cover)" },
};
const REASONS = {
  fr: { chaleur: "trop de jours de chaleur extrême", "trop froid": "température moyenne du cycle trop basse", "trop chaud": "température moyenne du cycle trop élevée", gel: "risque de gel pendant le cycle", "eau insuffisante": "pluie insuffisante sur le cycle (sans irrigation)" },
  en: { chaleur: "too many extreme heat days", "trop froid": "average temperature over the cycle is too low", "trop chaud": "average temperature over the cycle is too high", gel: "frost risk during the cycle", "eau insuffisante": "not enough rain over the cycle (no irrigation)" },
};

export const CROP_LIST: Crop[] = CROPS;
export const SOURCES = {
  note: "Résolutions indicatives, d’après la documentation NASA POWER (power.larc.nasa.gov).",
  sources: [
    { source: "NASA POWER (MERRA-2)", variable: "PRECTOTCORR", meaning: "Précipitations corrigées (mm/jour)", resolution: "environ 0,5° × 0,625°", period: "2011–2024", status: "utilisé" },
    { source: "NASA POWER (MERRA-2)", variable: "T2M, T2M_MIN, T2M_MAX", meaning: "Température de l’air à 2 m (°C)", resolution: "environ 0,5° × 0,625°", period: "2011–2024", status: "utilisé" },
    { source: "NASA POWER (MERRA-2)", variable: "RH2M", meaning: "Humidité relative (%)", resolution: "environ 0,5° × 0,625°", period: "2011–2024", status: "utilisé" },
    { source: "NASA POWER (CERES)", variable: "ALLSKY_SFC_SW_DWN", meaning: "Rayonnement solaire (kWh/m²/jour)", resolution: "environ 1°", period: "2011–2024", status: "utilisé" },
    { source: "NASA POWER (MERRA-2)", variable: "GWETROOT, GWETTOP", meaning: "Humidité du sol, racine et surface (0–1)", resolution: "environ 0,5° × 0,625°", period: "2011–2024", status: "utilisé" },
    { source: "NASA POWER (MERRA-2)", variable: "EVPTRNS", meaning: "Flux d’énergie d’évapotranspiration (MJ/m²/jour), non converti en mm", resolution: "environ 0,5° × 0,625°", period: "2011–2024", status: "archivé" },
    { source: "Calcul dans l’application", variable: "ETP (Hargreaves)", meaning: "Évapotranspiration estimée à partir des températures et de la latitude", resolution: "celle des températures", period: "2011–2024", status: "calculé" },
    { source: "Open-Meteo", variable: "Recherche de lieu", meaning: "Coordonnées d’un nom de lieu", resolution: "—", period: "—", status: "utilisé" },
  ],
};
export const ROADMAP = [
  { id: "smap", name: "SMAP", role: "Humidité du sol mesurée par satellite, pour affiner le stress hydrique par parcelle.", status: "planned" },
  { id: "gpm_imerg", name: "GPM / IMERG", role: "Précipitations quasi temps réel et à fine résolution.", status: "planned" },
  { id: "ndvi", name: "MODIS / Landsat (NDVI)", role: "Santé de la végétation, suivi de la couverture du sol et des rotations passées.", status: "planned" },
  { id: "ecostress", name: "ECOSTRESS", role: "Stress hydrique des plantes via la température de surface.", status: "planned" },
  { id: "grace", name: "GRACE", role: "Variations des eaux souterraines, pour la disponibilité de l’eau d’irrigation.", status: "planned" },
];

type Day = { date: string; precip: number; t: number; tmin: number; tmax: number; gwet: number | null };
type Fit = { ok: boolean; fit: number; reason: string | null; window_start: number | null; months: number[]; precip_mm: number | null; vulnerable_months: number[] };
type Profile = {
  precip: number[]; pet: number[]; tmean: number[]; tmin: number[]; tmax: number[]; soil: (number | null)[];
  hot: number; frostPct: number; cv: number | null; nYears: number;
  irrigated: boolean; soilClass: string; slope: string; rainy: number;
};

const dayCache = new Map<string, Day[]>();

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= -999) return null;
  return n;
}

function doy(iso: string) {
  const date = new Date(`${iso.slice(0, 4)}-${iso.slice(4, 6)}-${iso.slice(6, 8)}T00:00:00Z`);
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86400000);
}

function hargreaves(lat: number, day: string, t: number, tmin: number, tmax: number) {
  const j = doy(day);
  const phi = (lat * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * j) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * j) / 365 - 1.39);
  const ws = Math.acos(Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta))));
  const ra = ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  const range = Math.max(0, tmax - tmin);
  return Math.max(0, 0.0023 * (t + 17.8) * Math.sqrt(range) * 0.408 * ra);
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function loadDays(lat: number, lon: number, signal?: AbortSignal): Promise<Day[]> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = dayCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({
    parameters: "PRECTOTCORR,T2M,T2M_MIN,T2M_MAX,GWETROOT",
    community: "AG",
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start: "20110101",
    end: "20241231",
    format: "JSON",
  });
  const response = await fetch(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`, { signal });
  if (!response.ok) throw new Error(`NASA POWER ${response.status}`);
  const payload = await response.json();
  const series = payload.properties.parameter as Record<string, Record<string, number>>;
  const days: Day[] = [];
  for (const date of Object.keys(series.T2M)) {
    const t = num(series.T2M[date]);
    const tmin = num(series.T2M_MIN[date]);
    const tmax = num(series.T2M_MAX[date]);
    const precip = num(series.PRECTOTCORR[date]);
    if (t == null || tmin == null || tmax == null || precip == null) continue;
    days.push({ date, precip, t, tmin, tmax, gwet: num(series.GWETROOT?.[date]) });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 360) throw new Error("NASA POWER n’a pas renvoyé assez de jours pour ce point.");
  dayCache.set(key, days);
  return days;
}

function climateFrom(days: Day[], lat: number) {
  const monthBuckets = new Map<string, { precip: number; t: number[]; tmin: number[]; tmax: number[]; pet: number; gwet: number[] }>();
  const yearDays = new Map<number, number>();
  let hot = 0;
  let frostDays = 0;
  let extremeRain = 0;
  const frostYears = new Set<number>();
  const yearPrecip = new Map<number, number>();
  const yearTemp = new Map<number, number[]>();
  for (const day of days) {
    const year = Number(day.date.slice(0, 4));
    const month = Number(day.date.slice(4, 6));
    const pet = hargreaves(lat, day.date, day.t, day.tmin, day.tmax);
    const key = `${year}-${month}`;
    const bucket = monthBuckets.get(key) ?? { precip: 0, t: [], tmin: [], tmax: [], pet: 0, gwet: [] };
    bucket.precip += day.precip;
    bucket.t.push(day.t);
    bucket.tmin.push(day.tmin);
    bucket.tmax.push(day.tmax);
    bucket.pet += pet;
    if (day.gwet != null) bucket.gwet.push(day.gwet);
    monthBuckets.set(key, bucket);
    yearDays.set(year, (yearDays.get(year) ?? 0) + 1);
    if (day.tmax > 35) hot += 1;
    if (day.tmin <= 0) frostDays += 1;
    if (day.tmin <= 2) frostYears.add(year);
    if (day.precip >= 50) extremeRain += 1;
    yearPrecip.set(year, (yearPrecip.get(year) ?? 0) + day.precip);
    const temps = yearTemp.get(year) ?? [];
    temps.push(day.t);
    yearTemp.set(year, temps);
  }
  const fullYears = [...yearDays.entries()].filter(([, count]) => count >= 360).map(([year]) => year);
  const nYears = Math.max(fullYears.length, 1);
  const monthly = [...monthBuckets.entries()].map(([key, bucket]) => {
    const [year, month] = key.split("-").map(Number);
    return {
      year, month,
      precip_mm: bucket.precip,
      t2m: mean(bucket.t),
      t2m_min: mean(bucket.tmin),
      t2m_max: mean(bucket.tmax),
      pet_mm: bucket.pet,
      soil_wetness_root: bucket.gwet.length ? mean(bucket.gwet) : null,
    };
  });
  const byMonth = (field: "precip_mm" | "t2m" | "pet_mm") => {
    const groups = Array.from({ length: 12 }, () => [] as number[]);
    monthly.forEach((row) => groups[row.month - 1].push(row[field] as number));
    return groups.map((values) => (values.length ? mean(values) : 0));
  };
  const precip = byMonth("precip_mm");
  const temp = byMonth("t2m");
  const pet = byMonth("pet_mm");
  const wet = precip.map((p, index) => pet[index] > 0 && p >= 0.5 * pet[index]);
  const growing = wet.map((flag, index) => (flag ? index + 1 : 0)).filter(Boolean);
  const runs = wet.filter((flag, index) => flag && !wet[(index + 11) % 12]).length;
  const water = precip.map((p, index) => {
    const diff = p - pet[index];
    return { month: index + 1, precip_mm: p, pet_mm: pet[index], p_minus_pet_mm: diff, klass: diff < -20 ? "dry" : diff > 20 ? "humid" : "neutral" };
  });
  const annualP = fullYears.map((year) => yearPrecip.get(year) ?? 0);
  const annualT = fullYears.map((year) => mean(yearTemp.get(year) ?? [0]));
  const pMean = annualP.length ? mean(annualP) : 0;
  const tMean = annualT.length ? mean(annualT) : 0;
  const std = (values: number[], avg: number) => Math.sqrt(mean(values.map((value) => (value - avg) ** 2)));
  return {
    source: "NASA POWER (journalier, communauté AG)",
    is_demo: false,
    pet_method: "hargreaves",
    period: "2011-2024",
    climatology: precip.map((p, index) => ({ month: index + 1, precip_mm: p, t2m: temp[index], pet_mm: pet[index] })),
    trends: {},
    anomalies: [],
    extremes: {
      hot_days_avg: hot / nYears,
      heat_days_per_year: hot / nYears,
      frost_days_per_year: frostDays / nYears,
      frost_risk_pct: (frostYears.size / nYears) * 100,
      extreme_rain_days_per_year: extremeRain / nYears,
    },
    water_balance: water,
    season: {
      growing_months: growing,
      rainy_seasons: runs >= 2 ? 2 : 1,
      rule: "mois où les précipitations atteignent au moins la moitié de l’évapotranspiration",
    },
    interannual_cv: { precip: pMean ? std(annualP, pMean) / pMean : null, t2m: tMean ? std(annualT, tMean) / tMean : null },
    notes: ["ETP estimée par Hargreaves à partir des températures NASA POWER."],
    monthly,
    annualPrecip: pMean,
    annualTemp: tMean,
  };
}

function profileOf(climate: ReturnType<typeof climateFrom>, parcel: Parcel, scenario: Scenario): Profile {
  const avg = (key: "precip_mm" | "pet_mm" | "t2m" | "t2m_min" | "t2m_max" | "soil_wetness_root") => {
    const groups = Array.from({ length: 12 }, () => [] as number[]);
    climate.monthly.forEach((row) => {
      const value = row[key];
      if (typeof value === "number") groups[row.month - 1].push(value);
    });
    return groups.map((values) => (values.length ? mean(values) : null));
  };
  const dp = scenario.precip_delta_pct;
  const dt = scenario.temp_delta_c;
  const precip = avg("precip_mm").map((value) => (value ?? 0) * (1 + dp / 100));
  const pet = avg("pet_mm").map((value) => (value ?? 0) * (1 + PET_PER_C * dt));
  return {
    precip, pet,
    tmean: avg("t2m").map((value) => (value ?? 0) + dt),
    tmin: avg("t2m_min").map((value) => (value ?? 0) + dt),
    tmax: avg("t2m_max").map((value) => (value ?? 0) + dt),
    soil: avg("soil_wetness_root"),
    hot: Math.max(0, climate.extremes.hot_days_avg + HOT_PER_C * dt),
    frostPct: Math.min(100, Math.max(0, climate.extremes.frost_risk_pct * (1 - 0.2 * dt))),
    cv: climate.interannual_cv.precip,
    nYears: new Set(climate.monthly.map((row) => row.year)).size,
    irrigated: parcel.irrigation,
    soilClass: parcel.soil,
    slope: parcel.slope,
    rainy: parcel.rainy_seasons,
  };
}

function climateType(prof: Profile) {
  const rain = prof.precip.reduce((sum, value) => sum + value, 0);
  const temp = mean(prof.tmean);
  if (prof.frostPct >= 30 || temp < 14) return "temperate";
  if (rain < 500) return "semi_arid";
  return prof.rainy === 2 ? "tropical_bimodal" : "tropical_unimodal";
}

function cropFit(crop: CropRow, prof: Profile): Fit {
  const soilF = SOIL_F[prof.soilClass] ?? 1;
  const allowed = 10 + 90 * crop.heat_tol;
  const heatOk = prof.hot <= allowed;
  let best: { start: number; idx: number[]; precip: number; ratio: number } | null = null;
  const fails = new Map<string, number>();
  for (let start = 0; start < 12; start += 1) {
    const idx = Array.from({ length: crop.cycle_months }, (_, i) => (start + i) % 12);
    const rain = idx.reduce((sum, i) => sum + prof.precip[i], 0) * soilF;
    const temp = mean(idx.map((i) => prof.tmean[i]));
    const reasons: string[] = [];
    if (!heatOk) reasons.push("chaleur");
    if (temp < crop.t_mean_min) reasons.push("trop froid");
    else if (temp > crop.t_mean_max) reasons.push("trop chaud");
    if (crop.frost_tol < 0.4 && Math.min(...idx.map((i) => prof.tmin[i])) < FROST_SAFE) reasons.push("gel");
    if (!prof.irrigated && rain < crop.water_min_mm) reasons.push("eau insuffisante");
    if (reasons.length) {
      fails.set(reasons[0], (fails.get(reasons[0]) ?? 0) + 1);
      continue;
    }
    let ratio = Math.min(1, rain / crop.water_opt_mm);
    if (prof.irrigated) ratio = Math.max(ratio, 0.9);
    if (!best || ratio > best.ratio) best = { start, idx, precip: rain, ratio };
  }
  if (!best) {
    const reason = [...fails.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { ok: false, fit: 0.15, reason, window_start: null, months: [], precip_mm: null, vulnerable_months: [] };
  }
  let fit = 0.5 + 0.5 * best.ratio;
  if (prof.hot > 0.6 * allowed) fit -= 0.1;
  const vulnerable = [...new Set(best.idx.filter((i) =>
    (!prof.irrigated && crop.drought_tol < 0.6 && prof.precip[i] < 0.5 * prof.pet[i]) || (crop.heat_tol < 0.7 && prof.tmax[i] > 36),
  ))].map((i) => i + 1).sort((a, b) => a - b);
  return { ok: true, fit: Math.round(Math.max(0, fit) * 1000) / 1000, reason: null, window_start: best.start + 1, months: best.idx.map((i) => i + 1), precip_mm: best.precip, vulnerable_months: vulnerable };
}

function criteria(rows: CropRow[]) {
  const avg = (fn: (crop: CropRow) => number) => mean(rows.map(fn));
  const cover = rows.some((crop) => crop.group === "cover_legume");
  const nfix = rows.map((crop) => crop.n_fixation);
  return {
    water: avg((crop) => 0.6 * (1 - Math.min(1, crop.water_opt_mm / 1200)) + 0.4 * crop.drought_tol),
    erosion: Math.min(1, avg((crop) => 0.6 * crop.soil_cover + 0.4 * crop.rooting) + (cover ? 0.08 : 0)),
    organic_matter: avg((crop) => crop.organic_matter),
    nitrogen: 0.5 * mean(nfix) + 0.5 * Math.max(...nfix),
    income: avg((crop) => crop.market),
    pest_break: 0.5 * new Set(rows.map((crop) => crop.family)).size / rows.length + 0.5 * avg((crop) => crop.pest_break),
    fodder: avg((crop) => crop.fodder),
  };
}

function weightsOf(priorities: Priorities) {
  const weights = Object.fromEntries(KEYS.map((key) => [key, Math.max(0, priorities[key] ?? 5)])) as Record<typeof KEYS[number], number>;
  if (Object.values(weights).reduce((sum, value) => sum + value, 0) === 0) KEYS.forEach((key) => { weights[key] = 1; });
  return weights;
}

function scoreOf(seq: string[], fits: Record<string, Fit>, weights: Record<string, number>) {
  const crit = criteria(seq.map((id) => DB[id]));
  const fit = mean(seq.map((id) => fits[id].fit));
  const wsum = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const k = 1 - FIT_WEIGHT;
  const weighted = KEYS.reduce((sum, key) => sum + weights[key] * crit[key], 0) / wsum;
  return { total: k * weighted + FIT_WEIGHT * fit, crit, fit };
}

function permutations(pool: string[], length: number) {
  const out: string[][] = [];
  const used = new Array(pool.length).fill(false);
  const current: string[] = [];
  const walk = () => {
    if (current.length === length) {
      out.push([...current]);
      return;
    }
    pool.forEach((id, index) => {
      if (used[index]) return;
      used[index] = true;
      current.push(id);
      walk();
      current.pop();
      used[index] = false;
    });
  };
  walk();
  return out;
}

function canonical(combo: string[]) {
  const rotations = combo.map((_, index) => combo.slice(index).concat(combo.slice(0, index)).join("|"));
  return combo.join("|") === rotations.sort()[0];
}

function clash(combo: string[]) {
  return combo.some((id, index) => DB[id].family === DB[combo[(index + 1) % combo.length]].family);
}

function confidence(prof: Profile, seq: string[], fits: Record<string, Fit>) {
  let level = prof.cv == null ? 0 : prof.cv < 0.15 ? 2 : prof.cv < 0.25 ? 1 : 0;
  if (prof.nYears < 8) level = 0;
  else if (prof.nYears < 10) level = Math.min(level, 1);
  if (seq.some((id) => fits[id].fit < 0.5)) level = Math.max(0, level - 1);
  return (["faible", "moyen", "élevé"] as const)[level];
}

function describe(lang: Lang, prof: Profile, seq: string[], fits: Record<string, Fit>, score: ReturnType<typeof scoreOf>, base: ReturnType<typeof scoreOf>, baseline: boolean, weights: Record<string, number>) {
  const en = lang === "en";
  const name = (id: string) => (en ? DB[id].name_en : DB[id].name_fr);
  const labels = LABELS[lang];
  const months = MONTHS[lang];
  const gains = KEYS
    .filter((key) => weights[key] > 0)
    .map((key) => [score.crit[key] - base.crit[key], key] as const)
    .filter(([delta]) => delta > 0.03)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2);
  const why = baseline
    ? (en ? "Your current rotation, used as the comparison baseline." : "Votre rotation actuelle, utilisée comme référence de comparaison.")
    : gains.length
      ? (en ? `Suggested because it mainly improves: ${gains.map(([delta, key]) => `${labels[key]} (+${Math.round(delta * 100)})`).join(" and ")}.`
        : `Proposée car elle améliore surtout : ${gains.map(([delta, key]) => `${labels[key]} (+${Math.round(delta * 100)} points)`).join(" et ")}.`)
      : (en ? "Suggested as an option that fits the climate and your priorities." : "Proposée comme alternative cohérente avec le climat et vos priorités.");
  const benefits = baseline
    ? [...new Set(seq)].map((id) => `${name(id)} : ${DB[id].notes_fr}`)
    : [
      ...gains.map(([delta, key]) => en ? `Better ${labels[key]} than the current rotation (+${Math.round(delta * 100)})` : `Meilleure ${labels[key]} que la rotation actuelle (+${Math.round(delta * 100)} points)`),
      ...[...new Set(seq)].slice(0, 3).map((id) => `${name(id)} : ${DB[id].notes_fr}`),
    ];
  const evidence: { variable: string; finding: string }[] = [];
  const risks: string[] = [];
  const timeline = [...new Set(seq)].map((id) => {
    const fit = fits[id];
    const crop = DB[id];
    if (fit.ok && fit.window_start && fit.precip_mm != null) {
      evidence.push({
        variable: "PRECTOTCORR",
        finding: en
          ? `Average rain over the ${name(id)} cycle (from ${months[fit.window_start - 1]}, ${crop.cycle_months} months): ${Math.round(fit.precip_mm)} mm, versus about ${crop.water_min_mm} to ${crop.water_opt_mm} mm needed.`
          : `Pluie moyenne sur le cycle du ${name(id).toLowerCase()} (fenêtre ${months[fit.window_start - 1]}, ${crop.cycle_months} mois) : ${Math.round(fit.precip_mm)} mm, pour un besoin d’environ ${crop.water_min_mm} à ${crop.water_opt_mm} mm.`,
      });
      const wet = fit.months.map((month) => prof.soil[month - 1]).filter((value): value is number => value != null);
      if (wet.length) {
        const value = mean(wet).toFixed(2);
        evidence.push({ variable: "GWETROOT", finding: en ? `Average root-zone soil wetness over this window: ${value} (scale 0 to 1).` : `Humidité moyenne du sol racinaire sur cette fenêtre : ${value} (échelle 0 à 1).` });
      }
    } else if (fit.reason) {
      risks.push(`${name(id)} : ${en ? `a poor fit (${REASONS.en[fit.reason as keyof typeof REASONS.en]})` : `peu adapté au climat (${REASONS.fr[fit.reason as keyof typeof REASONS.fr]})`}.`);
    }
    if (fit.vulnerable_months.length) {
      const listed = fit.vulnerable_months.map((month) => months[month - 1]).join(", ");
      risks.push(`${name(id)} : ${en ? `likely vulnerable months (${listed}).` : `mois de vulnérabilité probables (${listed}).`}`);
    }
    return { crop: id, crop_name: name(id), months: fit.months, vulnerable_months: fit.vulnerable_months };
  });
  evidence.push({ variable: "T2M_MAX", finding: en ? `On average ${prof.hot.toFixed(1)} days per year above 35 °C.` : `En moyenne ${prof.hot.toFixed(1)} jours par an au-dessus de 35 °C.` });
  evidence.push({ variable: "ETP (Hargreaves)", finding: en ? "Evapotranspiration estimated with Hargreaves from NASA POWER temperatures." : "Évapotranspiration estimée par Hargreaves à partir des températures NASA POWER." });
  if (new Set(seq.map((id) => DB[id].family)).size < seq.length) {
    risks.push(en ? "Several crops from the same family: shared pest and disease risk." : "Plusieurs cultures de la même famille : risque de maladies et ravageurs communs.");
  }
  if (prof.slope === "steep" && score.crit.erosion < 0.7) {
    risks.push(en ? "Steep field: soil cover looks too weak. Check erosion on site." : "Parcelle en forte pente : la protection du sol est insuffisante, risque d’érosion à vérifier sur place.");
  }
  if (prof.soilClass === "sandy") {
    risks.push(en ? "Sandy soil holds little water and nutrients. Confirm with what you see in the field." : "Sol sableux : retient peu l’eau et les nutriments ; à valider avec l’observation locale du sol.");
  }
  if (prof.cv != null && prof.cv >= 0.25) {
    risks.push(en ? "Rainfall varies a lot from year to year: keep a safety margin." : "Pluies très variables d’une année à l’autre : prévoir des marges de sécurité.");
  }
  return {
    sequence: seq,
    sequence_names: seq.map(name),
    total_score: Math.round(score.total * 1000) / 1000,
    criteria_scores: Object.fromEntries(KEYS.map((key) => [key, Math.round(score.crit[key] * 1000) / 1000])),
    why, evidence, benefits, local_risks: risks,
    info_gaps: en
      ? ["Real soil texture, pH and organic matter.", "Local prices and buyers.", "Seed actually available nearby.", "Real pest pressure in this area."]
      : ["Texture, pH et matière organique réels du sol.", "Prix locaux et débouchés.", "Semences disponibles à proximité.", "Pression réelle des ravageurs sur la zone."],
    confidence: confidence(prof, seq, fits),
    timeline,
  };
}

function recommend(lang: Lang, prof: Profile, baseline: string[], priorities: Priorities) {
  const weights = weightsOf(priorities);
  const fits = Object.fromEntries(CROPS.map((crop) => [crop.id, cropFit(crop, prof)])) as Record<string, Fit>;
  const base = scoreOf(baseline, fits, weights);
  const names = NAMES[lang];
  const strategies = [{ id: "baseline", name: names.baseline, is_baseline: true, ...describe(lang, prof, baseline, fits, base, base, true, weights) }];
  const ok = CROPS.filter((crop) => fits[crop.id].ok).map((crop) => crop.id);
  const length = Math.min(Math.min(4, Math.max(3, baseline.length)), ok.length);
  if (length >= 2) {
    const single = Object.fromEntries(ok.map((id) => [id, scoreOf([id], fits, weights).total]));
    const pool = [...ok].sort((a, b) => single[b] - single[a]).slice(0, 12);
    const candidates = permutations(pool, length)
      .filter((combo) => canonical(combo) && !clash(combo))
      .map((combo) => {
        const score = scoreOf(combo, fits, weights);
        return { combo, score, balanced: score.total, resilient: 0.5 * score.fit + 0.5 * score.crit.water, soil: mean([score.crit.organic_matter, score.crit.nitrogen, score.crit.erosion]) };
      });
    const used = new Set([ [...baseline].sort().join("|") ]);
    (["balanced", "resilient", "soil"] as const).forEach((key) => {
      const pick = candidates.filter((item) => !used.has([...item.combo].sort().join("|"))).sort((a, b) => b[key] - a[key])[0];
      if (!pick) return;
      used.add([...pick.combo].sort().join("|"));
      strategies.push({ id: key, name: names[key], is_baseline: false, ...describe(lang, prof, pick.combo, fits, pick.score, base, false, weights) });
    });
  }
  const reasons = REASONS[lang];
  const excluded = CROPS.filter((crop) => !fits[crop.id].ok).map((crop) => ({
    id: crop.id,
    name: lang === "en" ? crop.name_en : crop.name_fr,
    reason: reasons[fits[crop.id].reason as keyof typeof reasons],
  }));
  const kind = climateType(prof) as keyof typeof CLIMATE_NAME.fr;
  const best = strategies.filter((item) => !item.is_baseline).sort((a, b) => b.total_score - a.total_score)[0];
  const rain = Math.round(prof.precip.reduce((sum, value) => sum + value, 0));
  const temp = mean(prof.tmean);
  const summary = lang === "en"
    ? [
      `This place receives about ${rain} mm of rain a year and averages ${temp.toFixed(1)} °C (${CLIMATE_NAME.en[kind]} climate).`,
      best && best.total_score > strategies[0].total_score
        ? `“${best.name}” (${best.sequence_names.join(" → ")}) scores ${Math.round(best.total_score * 100)}/100 against ${Math.round(strategies[0].total_score * 100)}/100 for your current rotation.`
        : `Your current rotation scores ${Math.round(strategies[0].total_score * 100)}/100 and stays competitive with the options tested.`,
      `Confidence is ${{ faible: "low", moyen: "medium", élevé: "high" }[strategies[0].confidence]} (rainfall variability over ${prof.nYears} years). These results help compare options and should be checked with a local farm adviser.`,
    ]
    : [
      `Ce lieu reçoit en moyenne ${rain} mm de pluie par an pour ${temp.toFixed(1)} °C (climat ${CLIMATE_NAME.fr[kind]}).`,
      best && best.total_score > strategies[0].total_score
        ? `La stratégie « ${best.name} » (${best.sequence_names.join(" → ")}) obtient ${Math.round(best.total_score * 100)}/100 contre ${Math.round(strategies[0].total_score * 100)}/100 pour votre rotation actuelle, selon vos priorités.`
        : `Votre rotation actuelle obtient ${Math.round(strategies[0].total_score * 100)}/100 et reste compétitive face aux alternatives testées.`,
      `Niveau de confiance ${strategies[0].confidence} (variabilité des pluies sur ${prof.nYears} ans) : ces résultats aident à comparer des options et doivent être validés avec un conseiller agricole local.`,
    ];
  return { summary, climate_type: kind, strategies, excluded_crops: excluded };
}

const ASSUMPTIONS = {
  fr: [
    "Les chiffres viennent de NASA POWER pour le point choisi, années 2011 à 2024.",
    "L’évapotranspiration est estimée par Hargreaves, pas mesurée dans le champ.",
    "Le scénario de pluie et de température est un test de sensibilité, pas une prévision.",
    "Les valeurs des cultures sont indicatives et doivent être relues avec un conseiller local.",
  ],
  en: [
    "Figures come from NASA POWER at the chosen point, years 2011 to 2024.",
    "Evapotranspiration is estimated with Hargreaves, not measured in the field.",
    "The rain and temperature scenario is a sensitivity test, not a forecast.",
    "Crop values are indicative and should be checked with a local adviser.",
  ],
};

export async function geocodePlace(query: string) {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=fr&format=json`);
  if (!response.ok) throw new Error("Recherche de lieu indisponible");
  const payload = await response.json();
  return ((payload.results ?? []) as { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[]).map((item) => ({
    name: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
    lat: item.latitude,
    lon: item.longitude,
  }));
}

export async function analyzePlace(input: { lat: number; lon: number; parcel: Parcel; priorities: Priorities; scenario: Scenario; lang: Lang }, signal?: AbortSignal): Promise<Analyze> {
  const unknown = input.parcel.current_rotation.filter((id) => !DB[id]);
  if (unknown.length) throw new Error(`Cultures inconnues : ${unknown.join(", ")}`);
  const days = await loadDays(input.lat, input.lon, signal);
  const climate = climateFrom(days, input.lat);
  const prof = profileOf(climate, input.parcel, input.scenario);
  const result = recommend(input.lang, prof, input.parcel.current_rotation, input.priorities);
  return {
    is_demo: false,
    summary: result.summary,
    climate_type: result.climate_type,
    climate,
    strategies: result.strategies,
    excluded_crops: result.excluded_crops,
    assumptions: ASSUMPTIONS[input.lang],
  };
}
