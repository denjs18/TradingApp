const BASE = "/api/auth";

async function fetchAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("trading_token") : null;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

export interface AuthUser {
  id: string;
  email: string;
  has_groq_key: boolean;
  created_at?: string;
}

export async function register(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return fetchAuth(`${BASE}/register`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return fetchAuth(`${BASE}/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<AuthUser> {
  return fetchAuth(`${BASE}/me`);
}

export async function updateProfile(data: { groq_api_key?: string }): Promise<void> {
  return fetchAuth(`${BASE}/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("trading_token");
  }
}
