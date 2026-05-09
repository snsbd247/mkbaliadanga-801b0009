// Multi-Dag number utilities.
// A "dag_no" string can hold multiple dag numbers separated by commas
// (e.g. "123, 124/A, 125-B"). This module is the single source of truth
// for parsing, validating, and formatting that representation across the
// app (Lands form, search, receipts, invoices, reports, importer).

export const DAG_NUMBER_PATTERN = /^[A-Za-z0-9০-৯\u09E6-\u09EF/\-]+$/;

export type DagValidation =
  | { ok: true; values: string[] }
  | { ok: false; error: string; values: string[] };

/** Split a raw dag_no string into trimmed, non-empty parts (preserves order). */
export function parseDagNumbers(input?: string | null): string[] {
  if (!input) return [];
  return String(input)
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

/** Returns true when the search query matches any individual dag in the joined string. */
export function matchesDagSearch(dag_no: string | null | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = parseDagNumbers(dag_no);
  if (parts.some((p) => p.toLowerCase().includes(q))) return true;
  return (dag_no ?? "").toLowerCase().includes(q);
}
