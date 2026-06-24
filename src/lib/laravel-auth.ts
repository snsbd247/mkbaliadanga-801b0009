/**
 * Laravel auth bridge.
 *
 * Single source of truth for "are we talking to the Laravel API or Supabase?"
 * - If `VITE_API_BASE_URL` is set (VPS build) → Laravel mode.
 * - Otherwise → Supabase fallback (Lovable preview stays fully working).
 *
 * Nothing here imports Supabase, so importing this file is always safe.
 */

const TOKEN_KEY = "mkb_api_token";

/** Resolve the API base URL, or null when running in Supabase mode. */
export function getApiBaseUrl(): string | null {
  const url = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (url && url.trim()) return url.replace(/\/+$/, "");

  // Back-compat with the older VITE_API_URL env used by src/lib/api/client.ts
  const legacy = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (legacy && legacy.trim()) return legacy.replace(/\/+$/, "");

  return null;
}

/** True when a Laravel API base URL is configured. */
export function isLaravelMode(): boolean {
  return getApiBaseUrl() !== null;
}

// ── Token storage ────────────────────────────────────────────────────
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore (private mode / SSR) */
  }
}

export function clearToken(): void {
  setToken(null);
}

// ── Minimal fetch wrapper for the Laravel API ────────────────────────
export type LaravelUser = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  office_id: string | null;
  office?: unknown;
  is_active: boolean;
  roles: string[];
  role_labels?: Record<string, string>;
  permissions: string[];
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("Laravel API base URL is not configured.");

  const token = getToken();
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("api:unauthorized"));
    }
  }

  if (!res.ok) {
    const msg = body?.message || body?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return body as T;
}

// ── Auth API ─────────────────────────────────────────────────────────
export async function laravelLogin(
  identifier: string,
  password: string,
  device = "web",
): Promise<{ token: string; user: LaravelUser }> {
  const data = await request<{ token: string; user: LaravelUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password, device }),
  });
  setToken(data.token);
  return data;
}

export async function laravelMe(): Promise<LaravelUser | null> {
  if (!getToken()) return null;
  const data = await request<{ user: LaravelUser }>("/auth/me");
  return data.user;
}

export async function laravelLogout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    /* ignore network errors on logout */
  }
  clearToken();
}
