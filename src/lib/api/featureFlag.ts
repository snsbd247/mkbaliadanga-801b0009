// Production switchover flag.
// Default: API stack is primary. Set VITE_USE_API=0 to fall back to the
// legacy Supabase-powered routes (emergency rollback only).
const raw = String((import.meta as any).env?.VITE_USE_API ?? "1").trim();
export const USE_API_BACKEND = raw !== "0" && raw.toLowerCase() !== "false";

// Map of legacy top-level paths → API equivalents (used when USE_API_BACKEND).
export const LEGACY_TO_API: Record<string, string> = {
  "/auth": "/api/auth",
  "/dashboard": "/api/dashboard",
  "/admin": "/api/dashboard",
  "/farmers": "/api/farmers",
  "/loans": "/api/loans",
  "/loans/plans": "/api/loan-plans",
  "/savings": "/api/savings",
  "/payments": "/api/payments",
  "/reports": "/api/reports",
  "/accounts": "/api/accounts",
  "/journal-entry": "/api/journals",
  "/seasons": "/api/seasons",
  "/irrigation/rates": "/api/irrigation-rates",
  "/users": "/api/users",
  "/offices": "/api/offices",
  "/sms-logs": "/api/sms",
  "/audit": "/api/audit",
};
