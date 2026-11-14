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
  const [lang, setLang] = useState<Lang>("fr");
  const [pane, setPane] = useState<"place" | "field" | "result" | "alerts">("place");
  const [menu, setMenu] = useState(false);
  const [place, setPlace] = useState<Place>({ name: "", lat: 15, lon: 10 });
  const [marked, setMarked] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [parcel, setParcel] = useState<Parcel>({
    current_rotation: ["maize", "cassava"],
    soil: "sandy",
    slope: "moderate",
    irrigation: false,
    rainy_seasons: 2,
  });
  const [priorities, setPriorities] = useState<Priorities>({
    water: 7, erosion: 5, organic_matter: 8, nitrogen: 9, income: 6, pest_break: 5, fodder: 2,
  });
  const [scenario, setScenario] = useState<Scenario>({ precip_delta_pct: 0, temp_delta_c: 0 });
  const [result, setResult] = useState<Analyze | null>(null);
  const [tab, setTab] = useState<"results" | "climate" | "sources" | "roadmap">("results");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState("baseline");
  const [ticket, setTicket] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const crops = CROP_LIST;

  const body = useMemo(() => ({
    location: { name: place.name, lat: Number(place.lat.toFixed(4)), lon: Number(place.lon.toFixed(4)) },
    parcel,
    priorities,
    scenario,
    lang,
    start_year: 2011,
    end_year: 2024,
  }), [place, parcel, priorities, scenario, lang]);

  async function run(payload = body) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const data = await analyzePlace({
        lat: payload.location.lat,
        lon: payload.location.lon,
        parcel: payload.parcel,
        priorities: payload.priorities,
        scenario: payload.scenario,
        lang: payload.lang,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setResult(data);
      setOpenId(data.strategies[0]?.id ?? "baseline");
      setPane("result");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  }

  useEffect(() => {
    if (ticket === 0) return;
    const timer = setTimeout(() => run(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, ticket]);

  function pickPlace(next: Place) {
    setPlace(next);
    setMarked(true);
    setZoom(16);
    setHits([]);
    setQuery("");
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      setHits(await geocodePlace(query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const score = (value: number) => Math.round(value * 100);
  const confidenceLabel = (value: string) => (lang === "en" ? { faible: "low", moyen: "medium", élevé: "high" }[value] ?? value : value);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-soil-900 text-soil-50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <div>
            <p className="text-xs uppercase tracking-widest text-amber-200">NASA Space Apps · Field Shift</p>
            <h1 className="text-2xl font-semibold">TerraShift</h1>
            <p className="hidden max-w-xl text-sm text-stone-200 sm:block">
              {tx(lang,
                "Comparer des rotations pour le sol et le climat. Aide à la décision : ce n’est pas une consigne.",
                "Compare rotations for soil and climate. Decision support: this is not an instruction.")}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[8rem] truncate text-sm text-amber-100 sm:inline">{user.name}</span>
            <button className="hidden rounded-full border border-stone-400 px-3 py-2 text-sm md:inline" onClick={() => setLang(lang === "fr" ? "en" : "fr")}>
              {lang === "fr" ? "EN" : "FR"}
            </button>
            <button className="hidden rounded-full bg-white px-3 py-2 text-sm text-soil-900 md:inline" onClick={onLogout}>
              {tx(lang, "Sortir", "Log out")}
            </button>
            <button className="rounded-full bg-white px-4 py-2 text-sm font-medium text-soil-900 md:hidden" type="button" onClick={() => setMenu(true)}>
              {tx(lang, "Menu", "Menu")}
            </button>
          </div>
        </div>
      </header>

      <div className="bg-amber-50">
        <p className="mx-auto max-w-5xl px-4 py-3 text-sm text-amber-950">
          <strong>{tx(lang, "Quand consulter un expert local. ", "When to ask a local expert. ")}</strong>
          {tx(lang,
            "TerraShift ne remplace ni votre jugement ni un conseiller agricole. Parlez-en à quelqu’un du territoire si le sol, les semences, l’eau ou les prix diffèrent de ce que vous avez saisi.",
            "TerraShift does not replace your judgment or a local adviser. Talk to someone who knows the area if soil, seed, water or prices differ from what you entered.")}
        </p>
      </div>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 pb-24 md:pb-4">
        <section className={`rounded-2xl bg-white p-3 shadow-sm ${pane === "place" ? "block" : "hidden md:block"}`}>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 px-1">
            <h2 className="text-lg font-semibold">{tx(lang, "Où se trouve la parcelle ?", "Where is the field?")}</h2>
            <p className="text-sm text-stone-600">
              {marked ? `${place.name} · ${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°` : tx(lang, "Cliquez sur la carte ou cherchez un lieu", "Click the map or search for a place")}
            </p>
          </div>
          <MapPicker
            lat={place.lat}
            lon={place.lon}
            zoom={zoom}
            marked={marked}
            onPick={(lat, lon) => pickPlace({ name: tx(lang, "Point choisi sur la carte", "Point picked on the map"), lat, lon })}
          />
          <form onSubmit={search} className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tx(lang, "Rechercher un village, une ville…", "Search a village or city…")}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-3 text-base"
            />
            <button className="rounded-lg border border-leaf-700 px-4 py-2 text-leaf-700" type="submit">
              {tx(lang, "Chercher", "Search")}
            </button>
          </form>
          {hits.length > 0 && (
            <ul className="mt-2 divide-y rounded-lg border border-stone-200">
              {hits.map((hit) => (
                <li key={`${hit.lat}-${hit.lon}`}>
                  <button className="w-full px-3 py-2 text-left text-sm hover:bg-soil-50" type="button" onClick={() => pickPlace(hit)}>
                    {hit.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={!marked || busy}
            className="mt-3 w-full rounded-lg bg-leaf-700 px-4 py-3 text-base text-white disabled:opacity-40"
            onClick={() => setTicket((value) => value + 1)}
          >
            {tx(lang, "Analyser ce lieu avec NASA POWER", "Analyse this place with NASA POWER")}
          </button>
        </section>

        <section className={`rounded-2xl bg-white p-4 shadow-sm ${pane === "field" ? "block" : "hidden md:block"}`}>
          <h2 className="text-lg font-semibold">{tx(lang, "Votre parcelle", "Your field")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {tx(lang, "Sol (votre observation)", "Soil (what you see)")}
              <select className="mt-1 w-full rounded-lg border px-2 py-2" value={parcel.soil} onChange={(e) => setParcel({ ...parcel, soil: e.target.value as Parcel["soil"] })}>
                <option value="sandy">{tx(lang, "Sableux", "Sandy")}</option>
                <option value="loam">{tx(lang, "Limoneux", "Loam")}</option>
                <option value="clay">{tx(lang, "Argileux", "Clay")}</option>
              </select>
            </label>
            <label className="text-sm">
              {tx(lang, "Pente", "Slope")}
              <select className="mt-1 w-full rounded-lg border px-2 py-2" value={parcel.slope} onChange={(e) => setParcel({ ...parcel, slope: e.target.value as Parcel["slope"] })}>
                <option value="flat">{tx(lang, "Plate", "Flat")}</option>
                <option value="moderate">{tx(lang, "Modérée", "Moderate")}</option>
                <option value="steep">{tx(lang, "Forte", "Steep")}</option>
              </select>
            </label>
            <label className="text-sm">
              {tx(lang, "Saisons des pluies habituelles", "Usual rainy seasons")}
              <select className="mt-1 w-full rounded-lg border px-2 py-2" value={parcel.rainy_seasons} onChange={(e) => setParcel({ ...parcel, rainy_seasons: Number(e.target.value) as 1 | 2 })}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={parcel.irrigation} onChange={(e) => setParcel({ ...parcel, irrigation: e.target.checked })} />
              {tx(lang, "Irrigation disponible", "Irrigation available")}
            </label>
          </div>
          <p className="mt-4 text-sm font-medium">{tx(lang, "Rotation actuelle", "Current rotation")}</p>
          <div className="mt-2 space-y-2">
            {parcel.current_rotation.map((id, index) => (
              <div key={`${id}-${index}`} className="flex gap-2">
                <select
                  className="min-w-0 flex-1 rounded-lg border px-2 py-2"
                  value={id}
                  onChange={(e) => {
                    const next = [...parcel.current_rotation];
                    next[index] = e.target.value;
                    setParcel({ ...parcel, current_rotation: next });
                  }}
                >
                  {crops.map((crop) => <option key={crop.id} value={crop.id}>{cropName(crop, lang)}</option>)}
                </select>
                {parcel.current_rotation.length > 1 && (
                  <button type="button" className="rounded-lg border px-3" onClick={() => setParcel({ ...parcel, current_rotation: parcel.current_rotation.filter((_, i) => i !== index) })}>×</button>
                )}
              </div>
            ))}
            {parcel.current_rotation.length < 4 && crops[0] && (
              <button type="button" className="text-sm text-leaf-700 underline" onClick={() => setParcel({ ...parcel, current_rotation: [...parcel.current_rotation, crops[0].id] })}>
                {tx(lang, "Ajouter une culture", "Add a crop")}
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {PRIORITY_KEYS.map((key) => (
              <label key={key} className="text-sm">
                <span className="flex justify-between"><span>{PRIORITY_LABEL[lang][key]}</span><span>{priorities[key]}</span></span>
                <input
                  className="w-full"
                  type="range" min={0} max={10} value={priorities[key]}
                  onChange={(e) => setPriorities({ ...priorities, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </section>

        {(error || busy || result) && (
        <div className={pane === "result" ? "contents" : "hidden md:contents"}>
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {busy && (
          <p className="text-sm text-stone-600">
            {tx(lang, "Lecture de NASA POWER pour ce point. La première fois peut prendre une minute, ensuite le même lieu est réutilisé.", "Reading NASA POWER for this point. The first time can take a minute, then the same place is reused.")}
          </p>
        )}

        {result && (
          <>
            <section className="rounded-2xl bg-leaf-700 p-4 text-white shadow-sm">
              <h2 className="text-sm uppercase tracking-wide text-emerald-100">{tx(lang, "En trois phrases", "In three sentences")}</h2>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-base">
                {result.summary.map((sentence) => <li key={sentence}>{sentence}</li>)}
              </ol>
            </section>

            <nav className="flex gap-2 overflow-x-auto text-sm">
              {([
                ["results", tx(lang, "Stratégies", "Strategies")],
                ["climate", tx(lang, "Climat", "Climate")],
                ["sources", tx(lang, "Données utilisées", "Data used")],
                ["roadmap", tx(lang, "Feuille de route", "Roadmap")],
              ] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setTab(id)} className={`whitespace-nowrap rounded-full px-3 py-1 ${tab === id ? "bg-soil-900 text-white" : "bg-white"}`}>
                  {label}
                </button>
              ))}
            </nav>

            {tab === "results" && (
              <section className="space-y-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <h3 className="font-semibold">{tx(lang, "Et si le climat bouge ?", "What if the climate shifts?")}</h3>
                  <label className="mt-3 block text-sm">
                    {tx(lang, "Pluie", "Rain")} {scenario.precip_delta_pct > 0 ? "+" : ""}{scenario.precip_delta_pct} %
                    <input className="w-full" type="range" min={-40} max={40} value={scenario.precip_delta_pct} onChange={(e) => setScenario({ ...scenario, precip_delta_pct: Number(e.target.value) })} />
                  </label>
                  <label className="mt-2 block text-sm">
                    {tx(lang, "Température", "Temperature")} {scenario.temp_delta_c > 0 ? "+" : ""}{scenario.temp_delta_c} °C
                    <input className="w-full" type="range" min={-2} max={3} step={0.5} value={scenario.temp_delta_c} onChange={(e) => setScenario({ ...scenario, temp_delta_c: Number(e.target.value) })} />
                  </label>
                  <p className="mt-2 text-xs text-stone-500">
                    {tx(lang, "Le curseur recalcule la comparaison sur les données POWER de ce point.", "The slider recalculates the comparison on this point’s POWER data.")}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <h3 className="font-semibold">{tx(lang, "Comparaison", "Comparison")}</h3>
                  <StrategyRadar strategies={result.strategies} lang={lang} />
                </div>
                {result.strategies.map((strategy) => (
                  <article key={strategy.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(openId === strategy.id ? "" : strategy.id)}>
                      <span>
                        <span className="font-semibold">{strategy.name}</span>
                        <span className="mt-1 block text-sm text-stone-600">{strategy.sequence_names.join(" → ")}</span>
                      </span>
                      <span className="text-right text-sm">
                        <span className="block text-xl font-semibold">{score(strategy.total_score)}</span>
                        {tx(lang, "confiance", "confidence")} {confidenceLabel(strategy.confidence)}
                      </span>
                    </button>
                    {openId === strategy.id && (
                      <div className="mt-3 space-y-3 text-sm">
                        <p>{strategy.why}</p>
                        <SeasonStrip strategy={strategy} lang={lang} />
                        <div>
                          <h4 className="font-medium">{tx(lang, "Ce que disent les données POWER", "What POWER data shows")}</h4>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {strategy.evidence.map((item) => <li key={item.finding}><strong>{item.variable}.</strong> {item.finding}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium">{tx(lang, "Intérêts", "Benefits")}</h4>
                          <ul className="mt-1 list-disc pl-5">{strategy.benefits.map((item) => <li key={item}>{item}</li>)}</ul>
                        </div>
                        <div>
                          <h4 className="font-medium">{tx(lang, "Ce qui manque", "What is missing")}</h4>
                          <ul className="mt-1 list-disc pl-5">{strategy.info_gaps.map((item) => <li key={item}>{item}</li>)}</ul>
                        </div>
                        {strategy.local_risks.length > 0 && (
                          <div>
                            <h4 className="font-medium">{tx(lang, "Risques à vérifier sur place", "Risks to check locally")}</h4>
                            <ul className="mt-1 list-disc pl-5">{strategy.local_risks.map((item) => <li key={item}>{item}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
                {result.excluded_crops.length > 0 && (
                  <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                    <h3 className="font-semibold">{tx(lang, "Cultures écartées par le climat", "Crops ruled out by the climate")}</h3>
                    <ul className="mt-2 space-y-1">
                      {result.excluded_crops.slice(0, 8).map((crop) => <li key={crop.id}>{crop.name} — {crop.reason}</li>)}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {tab === "climate" && (
              <section className="space-y-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <h3 className="font-semibold">{tx(lang, "Année moyenne", "Average year")} · {result.climate.period}</h3>
                  <p className="mt-1 text-xs text-stone-500">{result.climate.source} · ETP {result.climate.pet_method}</p>
                  <ClimateChart rows={result.climate.climatology} lang={lang} />
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <p>{tx(lang, "Jours > 35 °C / an", "Days above 35 °C / year")}: <strong>{result.climate.extremes.heat_days_per_year?.toFixed(1)}</strong></p>
                    <p>{tx(lang, "Jours de gel / an", "Frost days / year")}: <strong>{result.climate.extremes.frost_days_per_year?.toFixed(1)}</strong></p>
                    <p>{tx(lang, "Jours ≥ 50 mm / an", "Days ≥ 50 mm / year")}: <strong>{result.climate.extremes.extreme_rain_days_per_year?.toFixed(1)}</strong></p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <h3 className="font-semibold">{tx(lang, "Bilan hydrique", "Water balance")}</h3>
                  <WaterChart rows={result.climate.water_balance} lang={lang} />
                  <p className="text-xs text-stone-500">{result.climate.season.rule}</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <h3 className="font-semibold">{tx(lang, "Calendrier de la rotation actuelle", "Current rotation calendar")}</h3>
                  {result.strategies[0] && <SeasonStrip strategy={result.strategies[0]} lang={lang} />}
                </div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                  <h3 className="font-semibold">{tx(lang, "Satellite et modèles, ou mesures au sol ?", "Satellites and models, or measurements in the field?")}</h3>
                  <p className="mt-1">
                    {tx(lang,
                      "NASA POWER décrit le climat d’une maille d’environ 50 km, pas le coin de votre champ. La pluie sous un arbre, la pente et le sol que vous touchez restent la référence. Utilisez ces courbes pour comparer des années, puis vérifiez avec un pluviomètre, un thermomètre ou le souvenir des saisons.",
                      "NASA POWER describes the climate of a cell about 50 km wide, not the corner of your field. Rain under a tree, slope and the soil in your hand stay the reference. Use these curves to compare years, then check them with a rain gauge, a thermometer or the memory of past seasons.")}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                  <h3 className="font-semibold">{tx(lang, "Mots utiles", "Useful words")}</h3>
                  <dl className="mt-2 space-y-2">
                    {GLOSSARY[lang].map((item) => (
                      <div key={item.term}>
                        <dt className="font-medium">{item.term}</dt>
                        <dd className="text-stone-700">{item.text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </section>
            )}

            {tab === "sources" && (
              <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                <h3 className="font-semibold">{tx(lang, "Données NASA utilisées", "NASA data in use")}</h3>
                <p className="mt-1 text-stone-600">{SOURCES.note}</p>
                <ul className="mt-3 space-y-3">
                  {SOURCES.sources.map((row) => (
                    <li key={row.variable} className="border-b border-stone-100 pb-2">
                      <p className="font-medium">{row.variable}</p>
                      <p>{row.meaning}</p>
                      <p className="text-xs text-stone-500">{row.source} · {row.resolution} · {row.period} · {row.status}</p>
                    </li>
                  ))}
                </ul>
                <h4 className="mt-4 font-medium">{tx(lang, "Hypothèses", "Assumptions")}</h4>
                <ul className="mt-1 list-disc pl-5">{result.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            )}

            {tab === "roadmap" && (
              <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
                <h3 className="font-semibold">{tx(lang, "Feuille de route", "Roadmap")}</h3>
                <p className="mt-1 text-stone-600">
                  {tx(lang,
                    "Ces sources ne sont pas branchées. Aucun chiffre de cet écran ne vient d’elles.",
                    "These sources are not connected. No number on this screen comes from them.")}
                </p>
                <ul className="mt-3 space-y-3">
                  {ROADMAP.map((item) => (
                    <li key={item.id}>
                      <p className="font-medium">{item.name} · {item.status}</p>
                      <p>{item.role}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        </div>
        )}

        <Alerts lang={lang} phone={user.phone} result={result} visible={pane === "alerts"} />
      </main>
      {menu && (
        <div className="fixed inset-0 z-40 flex flex-col bg-soil-900 px-6 pb-8 pt-6 text-soil-50 md:hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm text-amber-100">{user.name}</p>
            <button type="button" className="rounded-full border border-stone-400 px-4 py-2" onClick={() => setMenu(false)}>
              {tx(lang, "Fermer", "Close")}
            </button>
          </div>
          <nav className="mt-8 flex flex-col gap-2 text-2xl">
            {([
              ["place", tx(lang, "Lieu", "Place")],
              ["field", tx(lang, "Parcelle", "Field")],
              ["result", tx(lang, "Résultat", "Result")],
              ["alerts", tx(lang, "Alertes", "Alerts")],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className="rounded-2xl px-2 py-3 text-left" onClick={() => { setPane(id); setMenu(false); }}>
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-auto flex gap-2">
            <button type="button" className="flex-1 rounded-full border border-stone-400 py-3" onClick={() => setLang(lang === "fr" ? "en" : "fr")}>
              {lang === "fr" ? "English" : "Français"}
            </button>
            <button type="button" className="flex-1 rounded-full bg-white py-3 text-soil-900" onClick={onLogout}>
              {tx(lang, "Sortir", "Log out")}
            </button>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] text-sm md:hidden">
        {([
          ["place", tx(lang, "Lieu", "Place")],
          ["field", tx(lang, "Parcelle", "Field")],
          ["result", tx(lang, "Résultat", "Result")],
          ["alerts", tx(lang, "Alertes", "Alerts")],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`py-3 ${pane === id ? "font-semibold text-leaf-700" : "text-stone-500"}`} onClick={() => setPane(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Alerts({
  lang, phone, result, visible,
}: {
  lang: Lang;
  phone: string;
  result: Analyze | null;
  visible: boolean;
}) {
  const message = alertMessage(lang, result);
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ${visible ? "block" : "hidden md:block"}`}>
      <h2 className="text-lg font-semibold">{tx(lang, "Alerte préparée", "Prepared alert")}</h2>
      <p className="mt-1 text-sm text-stone-600">
        {phone
          ? tx(lang, `Numéro du compte : ${phone}. L’envoi SMS n’est pas branché, le message reste ici.`, `Account number: ${phone}. SMS is not connected, so the message stays here.`)
          : tx(lang, "Aucun numéro sur ce compte. Ajoute-le sur la page de connexion.", "No number on this account. Add it on the sign-in page.")}
      </p>
      <div className="mt-4 rounded-2xl bg-soil-50 p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-stone-500">{tx(lang, "Message préparé", "Prepared message")}</p>
        <p className="mt-2 whitespace-pre-line">{message}</p>
      </div>
    </section>
  );
}

function alertMessage(lang: Lang, result: Analyze | null) {
  if (!result) {
    return tx(lang, "Analyse d’abord un lieu. Le message se remplit ensuite.", "Analyse a place first. The message fills in after that.");
  }
  const best = [...result.strategies].sort((a, b) => b.total_score - a.total_score)[0];
  const rain = Math.round(result.climate.climatology.reduce((sum, month) => sum + (month.precip_mm ?? 0), 0));
  const temps = result.climate.climatology.map((month) => month.t2m).filter((value): value is number => value != null);
  const temp = temps.length ? Math.round((temps.reduce((sum, value) => sum + value, 0) / temps.length) * 10) / 10 : null;
  const heat = result.climate.extremes.heat_days_per_year;
  const season = result.climate.season.length_days;
  const crop = best ? `${best.sequence_names.join(" → ")} (${Math.round(best.total_score * 100)}/100)` : "";
  if (lang === "en") {
    return [
      `Best-scoring sequence here: ${crop}.`,
      `Usual climate, 2011–2024: about ${rain} mm of rain a year${temp != null ? `, ${temp} °C` : ""}.`,
      season ? `Growing season around ${season} days.` : "",
      heat != null ? `About ${Math.round(heat)} days a year above 35 °C.` : "",
      "This is the habit of the place, not the weather of the coming days.",
    ].filter(Boolean).join("\n");
  }
  return [
    `Culture la mieux notée ici : ${crop}.`,
    `Climat habituel, 2011–2024 : environ ${rain} mm de pluie par an${temp != null ? `, ${temp} °C` : ""}.`,
    season ? `Saison de culture d’environ ${season} jours.` : "",
    heat != null ? `Environ ${Math.round(heat)} jours par an au-dessus de 35 °C.` : "",
    "C’est le climat habituel du lieu, pas la météo des prochains jours.",
  ].filter(Boolean).join("\n");
}
