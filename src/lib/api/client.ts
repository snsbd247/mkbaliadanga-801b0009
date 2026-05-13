import axios, { AxiosError, AxiosInstance } from "axios";

const TOKEN_KEY = "mkb_api_token";

export function getApiToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setApiToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

const baseURL =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8080/api` : "/api");

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
    const msg =
      (err.response?.data as any)?.message ||
      (err.response?.data as any)?.error ||
      err.message ||
      "Request failed";
    return Promise.reject(new Error(msg));
  }
);

export type Paginated<T> = {
  data: T[];
  meta?: { current_page: number; per_page: number; total: number; last_page: number };
};
