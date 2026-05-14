// Production switchover flag.
// - On a VPS build with VITE_API_URL set (or VITE_BACKEND=laravel), API stack is primary.
// - In Lovable preview (no VITE_API_URL), the legacy Supabase routes are primary.
// You can override explicitly with VITE_USE_API=1 (force API) or VITE_USE_API=0 (force legacy).
import { isLaravelBackend } from "@/lib/backend";

const raw = (import.meta as any).env?.VITE_USE_API;
const explicit = raw === undefined || raw === null || String(raw).trim() === "";
export const USE_API_BACKEND = explicit
  ? isLaravelBackend
  : String(raw).trim() !== "0" && String(raw).trim().toLowerCase() !== "false";

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
  // Newly mapped (Phase 4.2.1)
  "/lands": "/api/lands",
  "/assets": "/api/assets",
  "/irrigation": "/api/payments",
  "/irrigation/invoices": "/api/payments",
  "/irrigation/collect": "/api/payments",
  "/scan": "/api/qr",
  "/scan-payment": "/api/payments",
  "/cashbook": "/api/reports",
  "/statement": "/api/savings",
  "/dues": "/api/reports",
  "/financial-reports": "/api/reports",
  "/ledger": "/api/journals",
  "/ledger-integrity": "/api/audit",
  "/approvals": "/api/dashboard",
  "/period-close": "/api/accounts",
  "/finance-summary": "/api/reports",
  "/share-collection": "/api/savings",
  "/sms-settings": "/api/sms",
  "/voters": "/api/farmers",
  "/import": "/api/farmers",
  "/farmers/import": "/api/farmers",
};
