export type Lang = "fr" | "en";

export type Crop = {
  id: string;
  name_fr: string;
  name_en: string;
  group: string;
};

export type Place = { name: string; lat: number; lon: number };

export type Parcel = {
  current_rotation: string[];
  soil: "sandy" | "loam" | "clay";
  slope: "flat" | "moderate" | "steep";
  irrigation: boolean;
  rainy_seasons: 1 | 2;
};

export type Priorities = {
  water: number;
  erosion: number;
  organic_matter: number;
  nitrogen: number;
  income: number;
  pest_break: number;
  fodder: number;
};

export type Scenario = { precip_delta_pct: number; temp_delta_c: number };

export type Strategy = {
  id: string;
  name: string;
  is_baseline: boolean;
  sequence: string[];
  sequence_names: string[];
  total_score: number;
  criteria_scores: Record<string, number>;
  why: string;
  evidence: { variable: string; finding: string }[];
  benefits: string[];
  info_gaps: string[];
  local_risks: string[];
  confidence: "faible" | "moyen" | "élevé";
  timeline: { crop: string; crop_name?: string; months: number[]; vulnerable_months: number[] }[];
};

export type Analyze = {
  is_demo: boolean;
  summary: string[];
  climate_type: string;
  climate: {
    source: string;
    is_demo: boolean;
    pet_method: string;
    period: string;
    climatology: { month: number; precip_mm: number | null; t2m: number | null; pet_mm: number | null }[];
    trends: { t2m_c_per_decade?: number | null; precip_mm_per_decade?: number | null };
    anomalies: { month: number; year?: number; precip_mm: number | null; t2m_c: number }[];
    extremes: {
      heat_days_per_year?: number;
      frost_days_per_year?: number;
      extreme_rain_days_per_year?: number;
    };
    water_balance: { month: number; precip_mm: number; pet_mm: number; p_minus_pet_mm: number; klass: string }[];
    season: { growing_months?: number[]; rainy_seasons?: number; length_days?: number; rule?: string };
    interannual_cv: { precip?: number | null; t2m?: number | null };
    notes: string[];
  };
  strategies: Strategy[];
  excluded_crops: { id: string; name: string; reason: string }[];
  assumptions: string[];
};

export type SourceRow = {
  source: string;
  variable: string;
  meaning: string;
  resolution: string;
  period: string;
  status: string;
};

export type RoadmapItem = { id: string; name: string; role: string; status: string };

const PRIORITY_KEYS: (keyof Priorities)[] = [
  "water", "erosion", "organic_matter", "nitrogen", "income", "pest_break", "fodder",
];

export const EMPTY_PRIORITIES: Priorities = {
  water: 7, erosion: 5, organic_matter: 8, nitrogen: 9, income: 6, pest_break: 5, fodder: 2,
};

export function cropName(crop: Crop, lang: Lang) {
  return lang === "en" ? crop.name_en : crop.name_fr;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function getCrops() {
  return fetch("/api/crops").then((r) => asJson<Crop[]>(r));
}

export function getSources() {
  return fetch("/api/data-sources").then((r) => asJson<{ note: string; sources: SourceRow[] }>(r));
}

export function getRoadmap() {
  return fetch("/api/roadmap").then((r) => asJson<RoadmapItem[]>(r));
}

export function geocode(q: string) {
  return fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((r) => asJson<Place[]>(r));
}

export function analyze(body: unknown, signal?: AbortSignal) {
  return fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }).then((r) => asJson<Analyze>(r));
}

export { PRIORITY_KEYS };
