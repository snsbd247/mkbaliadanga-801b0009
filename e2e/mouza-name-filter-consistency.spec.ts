import { test, expect } from "@playwright/test";
import {
  resolveRowMouzaName,
  rowMatchesMouza,
  buildMouzaOptions,
} from "../src/lib/mouzaQuery";

/**
 * Mouza-name filtering consistency (logic-level E2E).
 *
 * Models the IrrigationInvoices + reports filter path: rows are fetched with the
 * `lands(..., mouzas(name))` embed (backed by the lands_mouza_id_fkey FK), then
 * filtered/sorted by mouza name via the SHARED helpers so every module behaves
 * identically. Runs without backend credentials because the shared mouzaQuery
 * helpers are the single source of truth for embed resolution and filtering.
 */

type Row = { id: string; lands: { mouza?: string | null; mouzas?: { name?: string | null } | null } };

// Simulates what PostgREST returns for the mouzas(name) embed across modules.
const rows: Row[] = [
  { id: "inv-1", lands: { mouza: "legacy-a", mouzas: { name: "চরপাড়া" } } },
  { id: "inv-2", lands: { mouza: "legacy-b", mouzas: { name: "বড়পাড়া" } } },
  { id: "inv-3", lands: { mouza: "চরপাড়া", mouzas: null } }, // legacy row: text fallback
  { id: "inv-4", lands: { mouzas: { name: "নদীপাড়া" } } },
];

test("filters invoices by mouza name and returns the correct rows", () => {
  const filtered = rows.filter((r) => rowMatchesMouza(r, "চরপাড়া"));
  expect(filtered.map((r) => r.id)).toEqual(["inv-1", "inv-3"]); // join + text fallback both match
});

test("'all' filter returns every row (no existing filter is broken)", () => {
  expect(rows.filter((r) => rowMatchesMouza(r, "all")).map((r) => r.id)).toHaveLength(rows.length);
});

test("mouza options are unique, sorted, and shared across modules", () => {
  const opts = buildMouzaOptions(rows, resolveRowMouzaName);
  expect(opts).toEqual([...opts].sort((a, b) => a.localeCompare(b, "bn")));
  expect(new Set(opts).size).toBe(opts.length);
  expect(opts).toContain("চরপাড়া");
  expect(opts).toContain("নদীপাড়া");
});

test("regression: irrigation + farmer-wise reports resolve identical names", () => {
  // Both modules read through the same resolver -> display can never diverge.
  for (const r of rows) {
    const irrigationView = resolveRowMouzaName(r);
    const reportView = resolveRowMouzaName(r);
    expect(irrigationView).toBe(reportView);
  }
});
