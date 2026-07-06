// Runtime backend adapter.
// - VPS build: set VITE_API_URL=https://api.example.com/api  → Laravel mode
// - Lovable preview / no env: falls back to Supabase mode (legacy /auth)
//
// You can also force a mode explicitly with VITE_BACKEND=laravel|supabase.

const explicit = (import.meta as any).env?.VITE_BACKEND as string | undefined;
const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;

export type BackendMode = "laravel" | "supabase";

export const BACKEND_MODE: BackendMode =
  explicit === "laravel" || explicit === "supabase"
    ? (explicit as BackendMode)
    : apiUrl
      ? "laravel"
      : "supabase";

export const isLaravelBackend = BACKEND_MODE === "laravel";
export const isSupabaseBackend = BACKEND_MODE === "supabase";

// Human-readable label + API base for debug panels.
export const BACKEND_API_BASE: string =
  isLaravelBackend ? (apiUrl ?? "(VITE_API_URL unset)") : "Lovable Cloud (Supabase Edge Functions)";

export const BACKEND_LABEL: string =
  isLaravelBackend ? "VPS (Laravel/MySQL)" : "Lovable Cloud";
