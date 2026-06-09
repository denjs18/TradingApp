const BASE = "/api/auth";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("trading_token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchAuth<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: authHeaders(),
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<{ token: string; user: { id: number; email: string } }> {
  const data = await fetchAuth<{ token: string; user: { id: number; email: string } }>(`${BASE}/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (typeof window !== "undefined") {
    localStorage.setItem("trading_token", data.token);
  }
  return data;
}

export async function register(email: string, password: string): Promise<{ token: string; user: { id: number; email: string } }> {
  const data = await fetchAuth<{ token: string; user: { id: number; email: string } }>(`${BASE}/register`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (typeof window !== "undefined") {
    localStorage.setItem("trading_token", data.token);
  }
  return data;
}

export interface UserProfile {
  id: number;
  email: string;
  has_groq_key: boolean;
  default_sectors: string;
  default_min_score: number;
  created_at: string;
}

export async function getMe(): Promise<UserProfile> {
  return fetchAuth<UserProfile>(`${BASE}/me`);
}

export async function updateProfile(data: {
  groq_api_key?: string;
  default_sectors?: string[];
  default_min_score?: number;
}): Promise<{ success: boolean }> {
  return fetchAuth<{ success: boolean }>(`${BASE}/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function logout(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("trading_token");
  }
}
