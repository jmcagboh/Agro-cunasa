import { FormEvent, useEffect, useState } from "react";
import App from "./App";
import { Account, currentAccount, login, logout, register } from "./auth";

type Screen = "home" | "login" | "register";

function Field({
  label, type, value, onChange, autoComplete,
}: { label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3 text-base"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

export default function Gate() {
  const [screen, setScreen] = useState<Screen>("home");
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentAccount()
      .then((user) => setAccount(user))
      .finally(() => setReady(true));
  }, []);

  function enter(next: Account) {
    setAccount(next);
    setPassword("");
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = screen === "register"
        ? await register(name, email, password)
        : await login(email, password);
      enter(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="p-6 text-sm text-stone-600">TerraShift…</p>;
  }

  if (account) {
    return <App user={account} onLogout={() => { void logout().finally(() => { setAccount(null); setScreen("home"); }); }} />;
  }

  return (
    <div className="min-h-screen bg-soil-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <p className="text-xs uppercase tracking-widest text-leaf-700">NASA Space Apps · Field Shift</p>
        <h1 className="mt-2 text-4xl font-semibold text-soil-900">TerraShift</h1>
        <p className="mt-2 text-base text-stone-700">
          Compare des rotations pour le sol et le climat. Aide à la décision : ce n’est pas une consigne.
        </p>

        {screen === "home" && (
          <div className="mt-8 flex flex-1 flex-col">
            <ol className="space-y-3">
              {[
                ["1", "Choisis le lieu de la parcelle sur la carte."],
                ["2", "Dis ce que tu cultives, et ce qui compte pour toi."],
                ["3", "Compare des rotations avec le climat NASA POWER."],
              ].map(([step, text]) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white">{step}</span>
                  <span className="pt-1 text-sm">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Un conseiller local reste nécessaire si le sol, les semences ou les prix de ton village diffèrent.
            </p>
            <div className="mt-auto space-y-3 pt-8">
              <button className="w-full rounded-xl bg-leaf-700 py-3 text-base font-medium text-white" type="button" onClick={() => { setScreen("register"); setError(""); }}>
                Créer un compte
              </button>
              <button className="w-full rounded-xl border border-soil-900 py-3 text-base font-medium" type="button" onClick={() => { setScreen("login"); setError(""); }}>
                J’ai déjà un compte
              </button>
            </div>
          </div>
        )}

        {screen !== "home" && (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <h2 className="text-2xl font-semibold">{screen === "register" ? "Créer un compte" : "Connexion"}</h2>
            {screen === "register" && (
              <Field label="Ton nom ou celui de l’exploitation" type="text" value={name} onChange={setName} autoComplete="name" />
            )}
            <Field label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field label="Mot de passe (8 caractères minimum)" type="password" value={password} onChange={setPassword} autoComplete={screen === "register" ? "new-password" : "current-password"} />
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <button className="w-full rounded-xl bg-leaf-700 py-3 text-base font-medium text-white disabled:opacity-50" disabled={busy} type="submit">
              {busy ? "Un instant…" : screen === "register" ? "Créer mon compte" : "Entrer"}
            </button>
            <button className="w-full py-2 text-sm text-leaf-700" type="button" onClick={() => setScreen(screen === "login" ? "register" : "login")}>
              {screen === "login" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
            </button>
            <button className="w-full py-2 text-sm text-stone-500" type="button" onClick={() => setScreen("home")}>
              Retour
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
