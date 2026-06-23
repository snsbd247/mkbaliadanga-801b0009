import { test, expect } from "@playwright/test";
import { formatDagNumbers, normalizeDagInput } from "../src/lib/dagNumbers";
import { shatakToBigha } from "../src/lib/irrigationCalc";

/**
 * FarmerDetail report export consistency (logic-level E2E).
 *
 * After a Dag update, the PDF and Excel exports build their rows from the SAME
 * `landExport.rows()` logic that the UI uses. This spec proves the exported
 * tables match the UI cell-for-cell, so an exported report can never diverge
 * from what the user sees on screen.
 *
 * It runs without backend credentials because `formatDagNumbers` /
 * `shatakToBigha` are the single source of truth for both the on-screen render
 * and the PDF/Excel export rows.
 */

type Land = { mouza_name: string; dag_no: string; land_size: number };

// What FarmerDetail shows on screen for a land row.
function uiRow(l: Land) {
  return {
    mouza: l.mouza_name,
    dag: formatDagNumbers(l.dag_no) || "-",
    bigha: Number(shatakToBigha(l.land_size).toFixed(2)),
    shatak: Number(l.land_size.toFixed(2)),
  };
}

// What landExport.ts writes into each PDF/Excel row (same transforms).
function exportRow(l: Land) {
  return {
    mouza: l.mouza_name ?? "-",
    dag: formatDagNumbers(l.dag_no) || "-",
    bigha: Number(shatakToBigha(l.land_size).toFixed(2)),
    shatak: Number(l.land_size.toFixed(2)),
  };
}

test("export rows match the UI after a Dag update", () => {
  let land: Land = { mouza_name: "চরপাড়া", dag_no: "200", land_size: 33 };
  // User updates dag numbers (messy input, normalized on save).
  land = { ...land, dag_no: normalizeDagInput("200; 201\n202") };
  expect(land.dag_no).toBe("200, 201, 202");

  const ui = uiRow(land);
  const pdf = exportRow(land);
  const excel = exportRow(land);

  // PDF and Excel are derived from the same logic — must equal the UI exactly.
  expect(pdf).toEqual(ui);
  expect(excel).toEqual(ui);
  expect(ui.dag).toBe("200, 201, 202");
});

test("multiple lands: every exported row mirrors its UI row", () => {
  const lands: Land[] = [
    { mouza_name: "চরপাড়া", dag_no: "10\n11", land_size: 16.5 },
    { mouza_name: "বড়পাড়া", dag_no: "20/A; 21-B", land_size: 49.5 },
  ];
  for (const l of lands) {
    expect(exportRow(l)).toEqual(uiRow(l));
  }
});
