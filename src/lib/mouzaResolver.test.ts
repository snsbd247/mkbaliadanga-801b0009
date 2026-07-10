import { describe, expect, it, vi } from "vitest";

const rows: Record<string, any[]> = {
  irrigation_invoice_payments: [
    { payment_id: "pay-linked", invoice_id: "inv-linked" },
  ],
  irrigation_invoices: [
    { id: "inv-linked", farmer_id: "farmer-1", land_id: "land-linked", invoice_status: "approved", deleted_at: null },
    { id: "inv-fallback", farmer_id: "farmer-2", land_id: "land-fallback", invoice_status: "approved", deleted_at: null },
  ],
  lands: [
    { id: "land-linked", farmer_id: "farmer-1", mouza_id: "mouza-manpur", mouza: null, deleted_at: null },
    { id: "land-fallback", farmer_id: "farmer-2", mouza_id: "mouza-kochla", mouza: null, deleted_at: null },
    { id: "land-text", farmer_id: "farmer-3", mouza_id: null, mouza: "পুরোনো টেক্সট", deleted_at: null },
  ],
  mouzas: [
    { id: "mouza-manpur", name_bn: "মানপুর", name: "Manpur" },
    { id: "mouza-kochla", name_bn: "কোচলাপাড়া", name: "Kochlapara" },
  ],
};

function query(table: string) {
  const filters: Array<{ column: string; values: unknown[] }> = [];
  const chain: any = {
    select: () => chain,
    is: () => chain,
    neq: () => chain,
    order: () => chain,
    in: (column: string, values: unknown[]) => {
      filters.push({ column, values });
      return chain;
    },
    then: (resolve: (value: { data: any[]; error: null }) => unknown) =>
      Promise.resolve({ data: applyFilters(rows[table] ?? [], filters), error: null }).then(resolve),
  };
  return chain;
}

function applyFilters(data: any[], filters: Array<{ column: string; values: unknown[] }>) {
  return data.filter((row) => filters.every((f) => f.values.includes(row[f.column])));
}

vi.mock("@/lib/db", () => ({ db: { from: (table: string) => query(table) } }));

import { namesMatchMouza, resolvePaymentMouzas } from "./mouzaQuery";

describe("resolvePaymentMouzas", () => {
  it("uses payment→invoice→land→mouzas for exact receipt mouza display and filtering", async () => {
    const resolved = await resolvePaymentMouzas([
      { id: "pay-linked", kind: "irrigation", farmer_id: "farmer-1" },
    ]);

    expect(resolved["pay-linked"].name).toBe("মানপুর");
    expect(resolved["pay-linked"].mouzaId).toBe("mouza-manpur");
    expect(resolved["pay-linked"].source).toBe("invoice-payment");
    expect(namesMatchMouza(resolved["pay-linked"].variants, "Manpur")).toBe(true);
    expect(namesMatchMouza(resolved["pay-linked"].variants, "মানপুর")).toBe(true);
  });

  it("falls back to the farmer invoice when a receipt has no invoice-payment link", async () => {
    const resolved = await resolvePaymentMouzas([
      { id: "pay-unlinked", kind: "irrigation", farmer_id: "farmer-2" },
    ]);

    expect(resolved["pay-unlinked"].name).toBe("কোচলাপাড়া");
    expect(resolved["pay-unlinked"].source).toBe("farmer-invoice");
    expect(namesMatchMouza(resolved["pay-unlinked"].variants, "Kochlapara")).toBe(true);
  });

  it("falls back to the nearest farmer land text when invoice links are missing", async () => {
    const resolved = await resolvePaymentMouzas([
      { id: "pay-text", kind: "irrigation", farmer_id: "farmer-3" },
    ]);

    expect(resolved["pay-text"].name).toBe("পুরোনো টেক্সট");
    expect(resolved["pay-text"].source).toBe("farmer-land");
    expect(namesMatchMouza(resolved["pay-text"].variants, "পুরোনো")).toBe(true);
  });
});