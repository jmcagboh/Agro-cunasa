export type Account = { id: number; name: string; email: string; token: string };

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const KEY = "terrashift-account";

export function savedAccount(): Account | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Account;
  } catch {
    return null;
  }
}

export function saveAccount(account: Account | null) {
  if (account) localStorage.setItem(KEY, JSON.stringify(account));
  else localStorage.removeItem(KEY);
}

async function post(path: string, body: unknown): Promise<Account> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Le serveur de comptes ne répond pas. Lance TerraShift avec run.bat.");
  }
  if (!response.ok) {
    let detail = "Compte refusé";
    try {
      const payload = await response.json();
      detail = payload.detail || detail;
    } catch {
      detail = response.status === 404 ? "Le serveur de comptes ne répond pas. Lance TerraShift avec run.bat." : detail;
    }
    throw new Error(typeof detail === "string" ? detail : "Compte refusé");
  }
  return response.json();
}

export function register(name: string, email: string, password: string) {
  return post("/api/auth/register", { name, email, password });
}

export function login(email: string, password: string) {
  return post("/api/auth/login", { email, password });
}

export async function currentAccount(token: string): Promise<Account> {
  const response = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("session");
  const user = await response.json();
  return { ...user, token };
}
