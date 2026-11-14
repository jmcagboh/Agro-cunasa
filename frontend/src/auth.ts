import { createClient, type User } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export type Account = { id: string; name: string; email: string; phone: string };

function toAccount(user: User): Account {
  const meta = user.user_metadata as { name?: string; phone?: string };
  return {
    id: user.id,
    name: meta.name || user.email?.split("@")[0] || "Compte",
    email: user.email ?? "",
    phone: meta.phone ?? "",
  };
}

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase n’est pas configuré. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans frontend/.env.local.");
  }
  return supabase;
}

function explain(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("invalid login") || text.includes("invalid credentials")) return "E-mail ou mot de passe incorrect.";
  if (text.includes("already registered") || text.includes("already been registered")) return "Un compte existe déjà avec cet e-mail.";
  if (text.includes("password")) return "Mot de passe refusé. Utilise au moins 8 caractères.";
  if (text.includes("email not confirmed")) return "Confirme d’abord l’e-mail, puis reconnecte-toi.";
  return message || "Compte refusé.";
}

export async function register(name: string, email: string, password: string, phone: string): Promise<Account> {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name, phone } },
  });
  if (error) throw new Error(explain(error.message));
  if (!data.user || !data.session) {
    throw new Error("Compte créé. Ouvre le mail de confirmation, puis connecte-toi. Dans Supabase, Authentication → Providers → Email, tu peux décocher Confirm email pour entrer tout de suite.");
  }
  return toAccount(data.user);
}

export async function login(email: string, password: string): Promise<Account> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(explain(error.message));
  if (!data.user) throw new Error("Connexion impossible.");
  return toAccount(data.user);
}

export async function currentAccount(): Promise<Account | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ? toAccount(data.session.user) : null;
}

export async function logout() {
  if (supabase) await supabase.auth.signOut();
}

export async function savePhone(phone: string): Promise<Account> {
  const client = requireClient();
  const { data, error } = await client.auth.updateUser({ data: { phone } });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Numéro non enregistré.");
  return toAccount(data.user);
}
