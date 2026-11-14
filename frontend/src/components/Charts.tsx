import {
  Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, PolarAngleAxis, PolarGrid,
  PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { Lang } from "../api";
import type { Strategy } from "../api";

const MONTHS_FR = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS_EN = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const CRITERIA = ["water", "erosion", "organic_matter", "nitrogen", "income", "pest_break", "fodder"] as const;

const CRITERIA_LABEL: Record<Lang, Record<string, string>> = {
  fr: {
    water: "Eau", erosion: "Érosion", organic_matter: "Matière org.", nitrogen: "Azote",
    income: "Revenu", pest_break: "Ravageurs", fodder: "Fourrage",
  },
  en: {
    water: "Water", erosion: "Erosion", organic_matter: "Organic matter", nitrogen: "Nitrogen",
    income: "Income", pest_break: "Pests", fodder: "Fodder",
  },
};

export function ClimateChart({
  rows, lang,
}: { rows: { month: number; precip_mm: number | null; t2m: number | null }[]; lang: Lang }) {
  const data = rows.map((row) => ({
    month: (lang === "en" ? MONTHS_EN : MONTHS_FR)[row.month - 1],
    rain: row.precip_mm == null ? null : Math.round(row.precip_mm),
    temp: row.t2m == null ? null : Number(row.t2m.toFixed(1)),
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4dfd4" />
          <XAxis dataKey="month" />
          <YAxis yAxisId="rain" />
          <YAxis yAxisId="temp" orientation="right" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="rain" dataKey="rain" name={lang === "en" ? "Rain (mm)" : "Pluie (mm)"} fill="#7d9a62" />
          <Line yAxisId="temp" dataKey="temp" name={lang === "en" ? "Temperature (°C)" : "Température (°C)"} stroke="#b45309" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WaterChart({
  rows, lang,
}: { rows: { month: number; p_minus_pet_mm: number }[]; lang: Lang }) {
  const data = rows.map((row) => ({
    month: MONTHS_FR[row.month - 1],
    balance: Math.round(row.p_minus_pet_mm),
  }));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4dfd4" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="balance" name={lang === "en" ? "Rain − ET (mm)" : "Pluie − ETP (mm)"} fill="#3f6b45" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StrategyRadar({ strategies, lang }: { strategies: Strategy[]; lang: Lang }) {
  const labels = CRITERIA_LABEL[lang];
  const data = CRITERIA.map((key) => {
    const row: Record<string, string | number> = { criterion: labels[key] };
    strategies.forEach((strategy) => {
      row[strategy.id] = Math.round((strategy.criteria_scores[key] ?? 0) * 100);
    });
    return row;
  });
  const colors = ["#243024", "#3f6b45", "#b45309", "#6b4f3a"];
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          {strategies.map((strategy, index) => (
            <Radar key={strategy.id} name={strategy.name} dataKey={strategy.id} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={0.15} />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeasonStrip({ strategy, lang }: { strategy: Strategy; lang: Lang }) {
  return (
    <div className="space-y-2">
      {strategy.timeline.map((row) => (
        <div key={row.crop} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-xs">
          <span className="truncate font-medium">{row.crop_name || row.crop}</span>
          <div className="grid grid-cols-12 gap-0.5">
            {Array.from({ length: 12 }, (_, index) => {
              const month = index + 1;
              const active = row.months.includes(month);
              const vulnerable = row.vulnerable_months.includes(month);
              const title = lang === "en" ? `Month ${month}` : `Mois ${month}`;
              return (
                <div
                  key={month}
                  title={title}
                  className={`h-4 rounded-sm ${vulnerable ? "bg-amber-500" : active ? "bg-leaf-600" : "bg-stone-200"}`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-stone-600">
        {lang === "en"
          ? "Green: crop in the field. Amber: month when water or heat looks tight."
          : "Vert : culture en place. Ambre : mois où l’eau ou la chaleur devient juste."}
      </p>
    </div>
  );
}
