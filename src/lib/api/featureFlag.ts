// Production switchover flag.
// Set VITE_USE_API=1 to make the Laravel-backed API stack the default
// (root `/` redirects to /api/dashboard, legacy Supabase routes still work).
export const USE_API_BACKEND =
  String((import.meta as any).env?.VITE_USE_API ?? "").trim() === "1";
