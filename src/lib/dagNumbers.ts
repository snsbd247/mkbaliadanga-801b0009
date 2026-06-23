// Multi-Dag number utilities.
// A "dag_no" string can hold multiple dag numbers separated by commas
// (e.g. "123, 124/A, 125-B"). This module is the single source of truth
// for parsing, validating, and formatting that representation across the
// app (Lands form, search, receipts, invoices, reports, importer).

export const DAG_NUMBER_PATTERN = /^[A-Za-z0-9০-৯\u09E6-\u09EF/\-]+$/;

export type DagValidation =
  | { ok: true; values: string[] }
  | { ok: false; error: string; values: string[] };

/**
 * Normalize a free-form dag_no input so downstream parsers/renders are stable
 * regardless of how the user typed (or pasted) the value.
 *
 * Rules:
 * - converts newlines / tabs / semicolons to commas
 * - collapses runs of whitespace
 * - drops empty tokens
 * - trims surrounding whitespace inside each token
 *
 * Returns canonical "a, b, c" string. Empty input → "".
 */
export function normalizeDagInput(input?: string | null): string {
  if (input === null || input === undefined) return "";
  const unified = String(input).replace(/[\n\r\t;]+/g, ",");
  return unified
    .split(",")
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => x.length > 0)
    .join(", ");
}

/** Split a raw dag_no string into trimmed, non-empty parts (preserves order).
 *  Input is normalized first so mixed separators / extra whitespace work. */
export function parseDagNumbers(input?: string | null): string[] {
  if (!input) return [];
  const normalized = normalizeDagInput(input);
  if (!normalized) return [];
  return normalized
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Validate a comma-separated dag_no input.
 * - each token must match {@link DAG_NUMBER_PATTERN}
 * - no duplicate tokens (case-insensitive)
 * - at least one token
 */
export function validateDagNumbers(input: string): DagValidation {
  const values = parseDagNumbers(input);
  if (values.length === 0) {
    return { ok: false, error: "দাগ নাম্বার আবশ্যক", values };
  }
  for (const v of values) {
    if (v.length > 32) {
      return { ok: false, error: `"${v}" — দাগ নাম্বার ৩২ অক্ষরের বেশি হতে পারবে না`, values };
    }
    if (!DAG_NUMBER_PATTERN.test(v)) {
      return {
        ok: false,
        error: `"${v}" — শুধু সংখ্যা, অক্ষর, ' / ' এবং ' - ' ব্যবহার করা যাবে (যেমন 123, 124/A, 125-B)`,
        values,
      };
    }
  }
  const seen = new Set<string>();
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) {
      return { ok: false, error: `ডুপ্লিকেট দাগ নাম্বার: "${v}"`, values };
    }
    seen.add(key);
  }
  return { ok: true, values };
}

/** Format dag list for display (default: comma-space; pass "\n" for receipts). */
export function formatDagNumbers(input?: string | null, separator: string = ", "): string {
  return parseDagNumbers(input).join(separator);
}

/**
 * Split a free-form search query into dag-like tokens. Accepts commas,
 * newlines, semicolons, slashes-of-spaces, or plain whitespace as separators
 * so users can paste "123, 124\n125" and still match each piece.
 */
export function parseDagSearchTokens(query: string): string[] {
  if (!query) return [];
  return String(query)
    .split(/[,\n;]+|\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/**
 * Returns true when the search query matches any individual dag in the joined
 * string. The query may itself contain multiple dag tokens (comma / newline /
 * whitespace separated) — a match on any token is enough.
 */
export function matchesDagSearch(dag_no: string | null | undefined, query: string): boolean {
  const raw = (query ?? "").trim().toLowerCase();
  if (!raw) return true;
  const haystack = (dag_no ?? "").toLowerCase();
  const parts = parseDagNumbers(dag_no).map((p) => p.toLowerCase());
  const tokens = parseDagSearchTokens(query).map((t) => t.toLowerCase());
  if (tokens.length === 0) return haystack.includes(raw);
  return tokens.some(
    (t) => parts.some((p) => p.includes(t)) || haystack.includes(t),
  );
}

/**
 * Given the dag tokens being saved and the list of dag_no strings already
 * registered in the same Mouza, return the first token that collides
 * (case-insensitive). Returns null when there is no conflict.
 */
export function findDuplicateDagInMouza(
  incoming: string[],
  existingDagStrings: Array<string | null | undefined>,
): string | null {
  const existing = new Set<string>();
  for (const s of existingDagStrings) {
    for (const t of parseDagNumbers(s)) existing.add(t.toLowerCase());
  }
  for (const t of incoming) {
    if (existing.has(t.toLowerCase())) return t;
  }
  return null;
}
