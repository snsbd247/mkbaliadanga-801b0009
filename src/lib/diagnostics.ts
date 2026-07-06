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
}

const MAX_ENTRIES = 50;
let entries: DiagnosticEntry[] = [];
let counter = 0;
const listeners = new Set<(e: DiagnosticEntry[]) => void>();

export function logDiagnostic(
  endpoint: string,
  status: DiagnosticStatus,
  detail = "",
): void {
  counter += 1;
  const entry: DiagnosticEntry = { id: counter, ts: Date.now(), endpoint, status, detail };
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  listeners.forEach((fn) => fn(entries));
  // Mirror to console so it is also captured in browser logs.
  const tag = `[diag:${status}] ${endpoint}`;
  if (status === "error") console.warn(tag, detail);
  else console.info(tag, detail);
}

export function getDiagnostics(): DiagnosticEntry[] {
  return entries;
}

export function clearDiagnostics(): void {
  entries = [];
  listeners.forEach((fn) => fn(entries));
}

export function subscribeDiagnostics(fn: (e: DiagnosticEntry[]) => void): () => void {
  listeners.add(fn);
  fn(entries);
  return () => {
    listeners.delete(fn);
  };
}
