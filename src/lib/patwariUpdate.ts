// Pure helpers for the "update land patwari during irrigation payment" flow.
// Kept framework-free so both the payment panel and tests can share the exact
// same logic (single-invoice and multi-invoice cases).

export interface PatwariUpdateInvoice {
  invoice_no: string;
  land_id: string | null;
  lands?: { mouza?: string | null; dag_no?: string | null; patwari_id?: string | null } | null;
}

export interface PatwariUpdateTarget {
  land_id: string;
  mouza: string | null;
  dag_no: string | null;
  invoice_no: string;
}

/**
 * Given the selected invoices and a manually chosen patwari, return the unique
 * lands whose patwari would actually change. Invoices without a land, or whose
 * land already has the selected patwari, are skipped. Returns [] when no manual
 * patwari is selected (so the existing behaviour is untouched).
 */
export function computePatwariUpdateTargets(
  invoices: PatwariUpdateInvoice[],
  manualPatwariId: string | null | undefined,
): PatwariUpdateTarget[] {
  if (!manualPatwariId) return [];
  const seen = new Set<string>();
  const rows: PatwariUpdateTarget[] = [];
  for (const inv of invoices) {
    const landId = inv.land_id;
    if (!landId || seen.has(landId)) continue;
    if (inv.lands?.patwari_id === manualPatwariId) continue;
    seen.add(landId);
    rows.push({
      land_id: landId,
      mouza: inv.lands?.mouza ?? null,
      dag_no: inv.lands?.dag_no ?? null,
      invoice_no: inv.invoice_no,
    });
  }
  return rows;
}
