import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Integration test: Mouza names must appear on the Receipts page,
 * resolved via irrigation_invoice_payments -> irrigation_invoices ->
 * lands.mouza_id -> mouzas table (name_bn preferred).
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
];

const iips = [
  {
    payment_id: "pay-1",
    irrigation_invoices: {
      land_id: "land-1",
      // mouza text column is empty; name resolves through mouzas relation via mouza_id
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
    in: () => Promise.resolve({ data: iips, error: null }),
    order: () => chain,
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

import Receipts from "../Receipts";

describe("Receipts page mouza rendering", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the mouza name resolved through lands.mouza_id -> mouzas", async () => {
    render(<TooltipProvider><Receipts /></TooltipProvider>);
    await waitFor(() => expect(screen.getByText("চরপাড়া")).toBeInTheDocument());
  });
});
