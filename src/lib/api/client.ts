import axios, { AxiosError, AxiosInstance } from "axios";
import { sharedSessionStorage } from "@/lib/sharedSessionStorage";

const TOKEN_KEY = "mkb_api_token";

export class ApiError extends Error {
  status?: number;
  code?: string;
  data?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; data?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = options?.status;
    this.code = options?.code;
    this.data = options?.data;
  }
}

export function getApiToken(): string | null {
  const s = sharedSessionStorage.getItem(TOKEN_KEY);
  if (s) return s;
  // Legacy: migrate any pre-existing localStorage token to sessionStorage once.
  try {
    const legacy = localStorage.getItem(TOKEN_KEY);
    if (legacy) {
      sharedSessionStorage.setItem(TOKEN_KEY, legacy);
      try { localStorage.removeItem(TOKEN_KEY); } catch {}
      return legacy;
    }
  } catch {}
  return null;
}
export function setApiToken(t: string | null) {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  if (t) sharedSessionStorage.setItem(TOKEN_KEY, t);
  else sharedSessionStorage.removeItem(TOKEN_KEY);
}

function resolveBaseURL(): string {
  const explicit = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (explicit) return explicit;
  if (typeof window === "undefined") return "/api";
  // Local Vite dev server (port 8080): talk to the Laravel backend on the same host.
  if (window.location.port === "8080") {
    return `${window.location.protocol}//${window.location.hostname}:8080/api`;
  }
  // Deployed (VPS/preview): API is proxied same-origin under /api.
  return "/api";
}

const baseURL = resolveBaseURL();

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  timeout: 30000,
});

api.interceptors.request.use((cfg) => {
  const t = getApiToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError<any>) => {
    if (err.response?.status === 401) {
      setApiToken(null);
      if (typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
        // Soft redirect
        window.dispatchEvent(new CustomEvent("api:unauthorized"));
      }
    }
    const data = err.response?.data as any;
    const msg =
      data?.message ||
      data?.error ||
      (typeof data === "string" && data.trim() ? data.trim() : undefined) ||
      err.message ||
      "Request failed";
    return Promise.reject(new ApiError(msg, {
      status: err.response?.status,
      code: data?.code,
      data,
    }));
  }
);

export type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; per_page: number; total: number; last_page: number };
};
