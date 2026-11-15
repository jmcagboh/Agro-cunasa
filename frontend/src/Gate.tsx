import { FormEvent, useEffect, useState } from "react";
import App from "./App";
import { Account, currentAccount, login, logout, register, savePhone } from "./auth";

type Screen = "home" | "login" | "register";

function Field({
  label, type, value, onChange, autoComplete, required = true, placeholder,
}: { label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3 text-base"
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function createGuestAccount(): Account {
  return { id: "guest", name: "Guest", email: "", phone: "" };
}

export default function Gate() {
  const [screen, setScreen] = useState<Screen>("home");
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
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

  function continueAsGuest() {
    enter(createGuestAccount());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (screen === "register" && !/^\\+?[0-9][0-9\\s-]{7,16}$/.test(phone.trim())) {
        throw new Error("Invalid phone number. Example: +228 90 00 00 00");
      }
      const next = screen === "register"
        ? await register(name, email, password, phone.trim())
        : await login(email, password);
      if (screen === "login" && phone.trim()) {
        if (!/^\\+?[0-9][0-9\\s-]{7,16}$/.test(phone.trim())) {
          throw new Error("Invalid phone number. Example: +228 90 00 00 00");
        }
        enter(await savePhone(phone.trim()));
      } else {
        enter(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    if (account?.id === "guest") {
      setAccount(null);
      setScreen("home");
      return;
    }
    void logout().finally(() => {
      setAccount(null);
      setScreen("home");
    });
  }

  if (!ready) {
    return <p className="p-6 text-sm text-stone-600">Loading TerraShift…</p>;
  }

  if (account) {
    return <App user={account} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-soil-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
        <p className="text-xs uppercase tracking-widest text-leaf-700">NASA Space Apps · Field Shift</p>
        <h1 className="mt-2 text-4xl font-semibold text-soil-900">TerraShift</h1>
        <p className="mt-2 text-base text-stone-700">
          Compare crop rotations for soil and climate. Decision support: this is not an instruction.
        </p>

        {screen === "home" && (
          <div className="mt-8 flex flex-1 flex-col">
            <ol className="space-y-3">
              {[
                ["1", "Choose the field location on the map."],
                ["2", "Tell us what you grow and what matters to you."],
                ["3", "Compare crop rotations using NASA POWER climate data."],
              ].map(([step, text]) => (
                <li key={step} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-leaf-700 text-white">{step}</span>
                  <span className="pt-1 text-sm">{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
              A local advisor is still recommended if the soil, seeds, or local prices differ from your context.
            </p>
            <div className="mt-auto space-y-3 pt-8">
              <button className="w-full rounded-xl bg-leaf-700 py-3 text-base font-medium text-white" type="button" onClick={() => { setScreen("register"); setError(""); }}>
                Create an account
              </button>
              <button className="w-full rounded-xl border border-soil-900 py-3 text-base font-medium" type="button" onClick={() => { setScreen("login"); setError(""); }}>
                I already have an account
              </button>
              <button className="w-full rounded-xl border border-leaf-700 py-3 text-base font-medium text-leaf-700 focus:outline-none focus:ring-2 focus:ring-leaf-700 focus:ring-offset-2" type="button" onClick={continueAsGuest}>
                Skip — continue without an account
              </button>
            </div>
          </div>
        )}

        {screen !== "home" && (
          <form className="mt-8 space-y-4" onSubmit={submit}>
            <h2 className="text-2xl font-semibold">{screen === "register" ? "Create an account" : "Sign in"}</h2>
            {screen === "register" && (
              <Field label="Your name or farm name" type="text" value={name} onChange={setName} autoComplete="name" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field label="Password (at least 8 characters)" type="password" value={password} onChange={setPassword} autoComplete={screen === "register" ? "new-password" : "current-password"} />
            <Field
              label={screen === "register" ? "Phone number" : "Phone number (optional update)"}
              type="tel"
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
              required={screen === "register"}
              placeholder="+228 90 00 00 00"
            />
            <p className="text-xs text-stone-500">
              This number prepares alerts about the highest-scoring crop and the usual local climate. SMS is not connected yet.
            </p>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
            <button className="w-full rounded-xl bg-leaf-700 py-3 text-base font-medium text-white disabled:opacity-50" disabled={busy} type="submit">
              {busy ? "Please wait…" : screen === "register" ? "Create my account" : "Sign in"}
            </button>
            <button className="w-full py-2 text-sm text-leaf-700" type="button" onClick={() => { setScreen(screen === "login" ? "register" : "login"); setError(""); }}>
              {screen === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
            <button className="w-full rounded-xl border border-leaf-700 py-3 text-base font-medium text-leaf-700 focus:outline-none focus:ring-2 focus:ring-leaf-700 focus:ring-offset-2" type="button" onClick={continueAsGuest}>
              Skip — continue without an account
            </button>
            <button className="w-full py-2 text-sm text-stone-500" type="button" onClick={() => { setScreen("home"); setError(""); }}>
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
