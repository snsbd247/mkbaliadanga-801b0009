// Captures recent Supabase RLS / permission errors for in-app debugging.
// Wraps window.fetch once and stores entries in memory + localStorage.

export interface RlsErrorEntry {
  ts: number;
  url: string;
  method: string;
  status: number;
  table?: string;
  rpc?: string;
  code?: string;
  message?: string;
  hint?: string;
  details?: string;
  policyHint?: string;
}

const KEY = "__rls_errors__";
const MAX = 50;
let installed = false;

function load(): RlsErrorEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(rows: RlsErrorEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX))); } catch {}
}

export function getRlsErrors(): RlsErrorEntry[] {
  return load().slice().reverse();
}
export function clearRlsErrors() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("rls-errors-changed"));
}

function policyHintFor(code?: string, msg?: string): string | undefined {
  if (!code && !msg) return;
  if (code === "42501") {
    if (msg?.includes("function")) return "rlsHelperFnNoExecute";
    return "rlsPolicyBlocked";
  }
  if (code === "PGRST301") return "jwtExpired";
  if (code === "PGRST116") return "rowNotFoundOrRls";
  if (code === "23505") return "uniqueViolation";
  if (code === "23503") return "fkInvalid";
  if (code === "23514") return "checkConstraintFail";
  return;
}

function parseTable(url: string): { table?: string; rpc?: string } {
  const m = url.match(/\/rest\/v1\/(rpc\/)?([^?]+)/);
  if (!m) return {};
  if (m[1]) return { rpc: m[2] };
  return { table: m[2] };
}

export function installRlsLogger() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);
    const method = (init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET").toUpperCase();
    const res = await orig(input as any, init);
    if (!url.includes("/rest/v1/") && !url.includes("/auth/v1/")) return res;
    if (res.ok) return res;
    if (![400, 401, 403, 404, 409, 422].includes(res.status)) return res;
    try {
      const clone = res.clone();
      const text = await clone.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch { body = { message: text }; }
      const { table, rpc } = parseTable(url);
      const entry: RlsErrorEntry = {
        ts: Date.now(), url: url.replace(/^https?:\/\/[^/]+/, ""), method, status: res.status,
        table, rpc, code: body?.code, message: body?.message, hint: body?.hint, details: body?.details,
        policyHint: policyHintFor(body?.code, body?.message),
      };
      const rows = load();
      rows.push(entry);
      save(rows);
      window.dispatchEvent(new Event("rls-errors-changed"));
    } catch {/* ignore */}
    return res;
  };
}
