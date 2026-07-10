import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Integration test: selecting a mouza in the Receipts filter shows only the
 * receipts whose land resolves to that mouza (via lands.mouza_id -> mouzas).
 * Verifies the name / name_bn / text variant matching used by the filter.
 */

const payments = [
  {
    id: "pay-1",
    kind: "irrigation",
    receipt_no: "R-001",
    amount: 500,
    status: "approved",
    created_at: "2026-07-01T00:00:00Z",
    farmers: { name_bn: "করিম", farmer_code: "F1" },
  },
  {
    id: "pay-2",
    kind: "irrigation",
    receipt_no: "R-002",
    amount: 700,
    status: "approved",
    created_at: "2026-07-02T00:00:00Z",
    farmers: { name_bn: "রহিম", farmer_code: "F2" },
  },
];

const iips = [
  {
    payment_id: "pay-1",
    irrigation_invoices: {
      land_id: "land-1",
      lands: { mouza: "", mouzas: { name_bn: "কোচলাপাড়া", name: "Kochlapara" } },
    },
  },
  {
    payment_id: "pay-2",
    irrigation_invoices: {
      land_id: "land-2",
      lands: { mouza: "", mouzas: { name_bn: "চরপাড়া", name: "Charpara" } },
    },
  },
];

function makeQuery(table: string) {
  const chain: any = {
    select: () => chain,
    is: () => chain,
    eq: () => chain,
    ilike: () => chain,
    gte: () => chain,
    lte: () => chain,
    order: () => chain,
    in: () => Promise.resolve({ data: table === "irrigation_invoice_payments" ? iips : [], error: null }),
    limit: () => Promise.resolve({ data: table === "payments" ? payments : [], error: null }),
  };
  return chain;
}

vi.mock("@/lib/db", () => ({ db: { from: (t: string) => makeQuery(t), rpc: () => Promise.resolve({ error: null }) } }));
vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/usePermission", () => ({ usePermission: () => true }));
vi.mock("@/lib/branding", () => ({ useBranding: () => ({}) }));
vi.mock("@/lib/receiptOptions", () => ({ useReceiptRenderArgs: () => ({ options: {} }) }));
vi.mock("@/i18n/LanguageProvider", () => ({
  useLang: () => ({ t: (k: string) => k, tx: (_en: string, bn: string) => bn }),
}));

// Replace MouzaSelect with a tiny stub that emits the ENGLISH name (as the real
// component does via `m.name`), so the filter must match through the variants.
vi.mock("@/components/locations/MouzaSelect", () => ({
  MouzaSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button aria-label="pick-mouza" onClick={() => onChange("Kochlapara")}>
      pick
    </button>
  ),
}));

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;

import Receipts from "../Receipts";

describe("Receipts page mouza filter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only the receipts matching the selected mouza", async () => {
    render(<TooltipProvider><Receipts /></TooltipProvider>);

    // Both receipts visible before filtering.
    await waitFor(() => expect(screen.getByText("R-001")).toBeInTheDocument());
    expect(screen.getByText("R-002")).toBeInTheDocument();

    // Select কোচলাপাড়া (stub emits the English name variant "Kochlapara").
    fireEvent.click(screen.getByLabelText("pick-mouza"));

    // Only the matching receipt remains.
    await waitFor(() => expect(screen.queryByText("R-002")).not.toBeInTheDocument());
    expect(screen.getByText("R-001")).toBeInTheDocument();
    expect(screen.getByText("কোচলাপাড়া")).toBeInTheDocument();
  });
});
