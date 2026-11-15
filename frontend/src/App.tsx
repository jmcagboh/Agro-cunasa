import { useEffect, useMemo, useRef, useState } from "react";
import {
  Analyze, Lang, Parcel, Place, Priorities, PRIORITY_KEYS, Scenario, cropName,
} from "./api";
import MapPicker from "./components/MapPicker";
import { ClimateChart, SeasonStrip, StrategyRadar, WaterChart } from "./components/Charts";
import { analyzePlace, CROP_LIST, geocodePlace, ROADMAP, SOURCES } from "./engine/analyze";
import type { Account } from "./auth";
import Logo from "./Logo";

function tx(lang: Lang, fr: string, en: string) {
  return lang === "en" ? en : fr;
}

const GLOSSARY: Record<Lang, { term: string; text: string }[]> = {
  fr: [
    { term: "Évapotranspiration", text: "Eau qui quitte le sol et les plantes vers l’air. Ici elle est estimée (méthode de Hargreaves), pas mesurée dans votre champ." },
    { term: "Anomalie", text: "Écart entre une année et la moyenne des années précédentes. Une anomalie positive de pluie veut dire un mois plus mouillé que d’habitude." },
    { term: "Bilan hydrique", text: "Pluie moins évapotranspiration, mois par mois. Négatif : le mois est plutôt sec pour les cultures." },
    { term: "Risque de gel", text: "Nombre moyen de jours où la température descend à 0 °C ou en dessous. Beaucoup de cultures tropicales ne le supportent pas." },
  ],
  en: [
    { term: "Evapotranspiration", text: "Water leaving the soil and plants into the air. Here it is estimated (Hargreaves), not measured in your field." },
    { term: "Anomaly", text: "How a year differs from the long-term average. A positive rain anomaly means a wetter month than usual." },
    { term: "Water balance", text: "Rain minus evapotranspiration, month by month. Negative means a rather dry month for crops." },
    { term: "Frost risk", text: "Average number of days at or below 0 °C. Many tropical crops cannot tolerate that." },
  ],
};

const PRIORITY_LABEL: Record<Lang, Record<string, string>> = {
  fr: {
    water: "Économiser l’eau", erosion: "Limiter l’érosion", organic_matter: "Matière organique",
    nitrogen: "Azote du sol", income: "Revenu", pest_break: "Couper les ravageurs", fodder: "Fourrage",
  },
  en: {
    water: "Save water", erosion: "Limit erosion", organic_matter: "Organic matter",
    nitrogen: "Soil nitrogen", income: "Income", pest_break: "Break pest cycles", fodder: "Fodder",
  },
};

export default function App({ user, onLogout }: { user: Account; onLogout: () => void }) {
  const [lang, setLang] = useState<Lang>("en");
