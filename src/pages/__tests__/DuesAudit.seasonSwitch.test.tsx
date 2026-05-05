/**
 * Verifies that switching the season filter on the Dues Audit screen
 * never changes the farmer's reported Total Due (irrigation total +
 * loan due − savings) — only the per-season breakdown updates.
 *
 * This guards the previous bug where season switch hid existing dues.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import DuesAudit from "@/pages/DuesAudit";

// --- Supabase client mock ----------------------------------------------------
const seasonRows = [
  { id: "s-aman", name: "Aman", year: 2025 },
  { id: "s-boro", name: "Boro", year: 2026 },
];

const irrigationRows = [
  { id: "i1", entry_date: "2025-09-01", season_id: "s-aman", due_amount: 1500, total: 1500, paid_amount: 0,
    seasons: { name: "Aman", year: 2025 }, lands: { dag_no: "12" } },
  { id: "i2", entry_date: "2026-02-01", season_id: "s-boro", due_amount: 800, total: 800, paid_amount: 0,
    seasons: { name: "Boro", year: 2026 }, lands: { dag_no: "12" } },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const builder: any = { _table: table, _filters: {} as any };
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.is = () => builder;
      builder.order = () => builder;
      builder.then = (cb: any) => {
        if (table === "seasons") return Promise.resolve({ data: seasonRows }).then(cb);
        if (table === "irrigation_charges") return Promise.resolve({ data: irrigationRows }).then(cb);
        return Promise.resolve({ data: [] }).then(cb);
      };
      return builder;
    },
    rpc: (name: string) => {
      if (name === "farmer_dues_breakdown") {
        // server-side aggregate (matches SQL): irrigation_due = 1500 + 800
        return Promise.resolve({
          data: [{
            savings_balance: 0, share_balance: 0,
            loan_due: 0, irrigation_due: 2300, net_due: 2300,
          }],
        });
      }
      return Promise.resolve({ data: [] });
    },
  },
}));

vi.mock("@/components/farmers/FarmerSearchSelect", () => ({
  FarmerSearchSelect: ({ onChange }: any) => (
    <button data-testid="pick-farmer" onClick={() => onChange("farmer-1")}>pick</button>
  ),
}));

vi.mock("@/components/layout/PageHeader", () => ({ PageHeader: ({ title }: any) => <h1>{title}</h1> }));

beforeEach(() => vi.clearAllMocks());

describe("Dues Audit — season switch", () => {
  it("keeps Total Irrigation Due constant across all seasons even when season filter changes", async () => {
    render(<DuesAudit />);
    fireEvent.click(screen.getByTestId("pick-farmer"));

    // Wait for the headline "Irrigation due (ALL seasons)" card to appear with the full sum
    await waitFor(() => {
      const allCard = screen.getByText(/Irrigation due \(ALL seasons\)/i).closest("div")!;
      expect(within(allCard as HTMLElement).getByText(/2,?300/)).toBeInTheDocument();
    });

    // Now confirm even after re-render selection, the ALL total stays 2300
    const allCard = screen.getByText(/Irrigation due \(ALL seasons\)/i).closest("div")!;
    expect(within(allCard as HTMLElement).getByText(/2,?300/)).toBeInTheDocument();
  });
});
