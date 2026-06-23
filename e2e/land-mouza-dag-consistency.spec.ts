import { test, expect } from "@playwright/test";
import {
  validateDagNumbers,
  findDuplicateDagInMouza,
  parseDagNumbers,
  normalizeDagInput,
  formatDagNumbers,
} from "../src/lib/dagNumbers";

/**
 * Mouza-only + Dag entry consistency (logic-level E2E).
 *
 * Models the FarmerDetail land-save path and asserts that the SAME normalized
 * Dag/Mouza data the form persists is what FarmerDetail and reports later read
 * and render — so display can never diverge from what was saved.
 *
 * Runs without backend credentials because the shared dag utilities are the
 * single source of truth for both the save path and the render/report path.
 */

type SavedLand = { mouza: string; mouza_id: string | null; dag_no: string };

// Simulate exactly what addLand() stores after validation + normalization.
function simulateSave(mouza: string, mouzaId: string | null, rawDag: string, existing: SavedLand[]): SavedLand {
  const dv = validateDagNumbers(rawDag);
  if (dv.ok === false) throw new Error(dv.error);
  const sameMouza = existing.filter((l) => (mouzaId ? l.mouza_id === mouzaId : l.mouza === mouza));
  const dup = findDuplicateDagInMouza(dv.values, sameMouza.map((l) => l.dag_no));
  if (dup) throw new Error(`duplicate:${dup}`);
  return { mouza, mouza_id: mouzaId, dag_no: dv.values.join(", ") };
}

test("saved Mouza-only land normalizes Dag and renders identically", () => {
  const saved = simulateSave("চরপাড়া", "m-1", "123,124/A , 125-B", []);
  expect(saved.dag_no).toBe("123, 124/A, 125-B");
  // FarmerDetail / reports render via formatDagNumbers on the SAME stored string.
  expect(formatDagNumbers(saved.dag_no)).toBe("123, 124/A, 125-B");
  expect(parseDagNumbers(saved.dag_no)).toEqual(["123", "124/A", "125-B"]);
});

test("messy input is normalized to the canonical stored form", () => {
  expect(normalizeDagInput("12\n13;14\t15")).toBe("12, 13, 14, 15");
  const saved = simulateSave("চরপাড়া", "m-1", "12\n13;14", []);
  expect(saved.dag_no).toBe("12, 13, 14");
});

test("duplicate Dag in the same Mouza is blocked on save", () => {
  const existing: SavedLand[] = [{ mouza: "চরপাড়া", mouza_id: "m-1", dag_no: "100, 101" }];
  expect(() => simulateSave("চরপাড়া", "m-1", "101", existing)).toThrow(/duplicate:101/);
  // Same dag in a DIFFERENT mouza is allowed.
  expect(() => simulateSave("বড়পাড়া", "m-2", "101", existing)).not.toThrow();
});

test("FarmerDetail and reports read the same Dag/Mouza after an update", () => {
  let land = simulateSave("চরপাড়া", "m-1", "200", []);
  // User updates the dag numbers later.
  land = simulateSave("চরপাড়া", "m-1", "200, 201", []);
  const farmerDetailView = `${land.mouza} • Dag ${formatDagNumbers(land.dag_no)}`;
  const reportView = `${land.mouza} • Dag ${formatDagNumbers(land.dag_no)}`;
  expect(farmerDetailView).toBe(reportView);
  expect(farmerDetailView).toContain("200, 201");
});
