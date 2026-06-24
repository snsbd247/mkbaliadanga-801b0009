/**
 * Generic Laravel API request helper used by all `*-api.ts` module wrappers.
 * Reuses token + base-url logic from laravel-auth.ts. Safe to import anywhere;
 * if no API base URL is configured these throw, so callers should guard with
 * `isLaravelMode()` (Supabase path stays the default in preview).
 */
import { getApiBaseUrl, getToken, clearToken } from "@/lib/laravel-auth";

export type Paginated<T> = {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

function qs(params?: Record<string, unknown>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.append(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("Laravel API base URL is not configured.");

  const token = getToken();
  const res = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
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
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, unknown>) => call<T>("GET", `${path}${qs(params)}`),
  post: <T>(path: string, body?: unknown) => call<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => call<T>("PUT", path, body),
  del: <T>(path: string) => call<T>("DELETE", path),
};
