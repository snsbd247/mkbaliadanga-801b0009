// Lightweight in-memory diagnostics log for backend endpoint calls.
// Used to surface which endpoint was hit, the response status (e.g. 501),
// and whether a fallback path was used — visible in the Diagnostics panel.

export type DiagnosticStatus = "ok" | "error" | "fallback" | "info";

export interface DiagnosticEntry {
  id: number;
  ts: number;
  endpoint: string;
  status: DiagnosticStatus;
  detail: string;
  durationMs?: number;
  usedFallback?: boolean;
}

const MAX_ENTRIES = 50;
const STORAGE_KEY = "mk:diagnostics:v1";

function load(): DiagnosticEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

let entries: DiagnosticEntry[] = load();
let counter = entries.reduce((m, e) => Math.max(m, e.id), 0);
const listeners = new Set<(e: DiagnosticEntry[]) => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full / unavailable — ignore
  }
}

export function logDiagnostic(
  endpoint: string,
  status: DiagnosticStatus,
  detail = "",
  opts?: { durationMs?: number; usedFallback?: boolean },
): void {
  counter += 1;
  const entry: DiagnosticEntry = {
    id: counter,
    ts: Date.now(),
    endpoint,
    status,
    detail,
    durationMs: opts?.durationMs,
    usedFallback: opts?.usedFallback ?? status === "fallback",
  };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  persist();
  listeners.forEach((fn) => fn(entries));
  // Mirror to console so it is also captured in browser logs.
  const tag = `[diag:${status}] ${endpoint}`;
  if (status === "error") console.warn(tag, detail);
  else console.info(tag, detail);
}

/** The endpoint family last used for serial generation: "fn", "rpc", "db", or null. */
export function lastSerialPath(): "fn" | "rpc" | "db" | null {
  const e = entries.find((x) => /receipt-serial|admin_set_receipt_serial|receipt_settings/.test(x.endpoint) && (x.status === "ok" || x.status === "fallback"));
  if (!e) return null;
  if (e.endpoint.includes("/api/fn")) return "fn";
  if (e.endpoint.includes("/api/rpc")) return "rpc";
  return "db";
}


export function getDiagnostics(): DiagnosticEntry[] {
  return entries;
}

export function clearDiagnostics(): void {
  entries = [];
  persist();
  listeners.forEach((fn) => fn(entries));
}

export function subscribeDiagnostics(fn: (e: DiagnosticEntry[]) => void): () => void {
  listeners.add(fn);
  fn(entries);
  return () => {
    listeners.delete(fn);
  };
}
