import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({ officeId: null }) }));
vi.mock("@/lib/branding", () => ({
  useBranding: () => ({ company_name: "Test Society", company_name_bn: "টেস্ট সমিতি" }),
}));

const makeQuery = (rows: any[]) => {
  const q: any = {
    select: () => q, is: () => q, gte: () => q, lte: () => q, eq: () => q,
    then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return q;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "savings_transactions")
        return makeQuery([
          { type: "deposit", amount: 1000, status: "approved" },
          { type: "share_collection", amount: 500, status: "approved" },
        ]);
      if (table === "expenses") return makeQuery([{ head: "Office Rent", amount: 200 }]);
      if (table === "bank_accounts")
        return makeQuery([{ id: "a", account_no: "111", account_title: "সমিতি", opening_balance: 5000 }]);
      return makeQuery([]);
    },
  },
}));

import SocietyCashStatement from "../SocietyCashStatement";

const renderReport = () =>
  render(
    <MemoryRouter>
      <SocietyCashStatement />
    </MemoryRouter>,
  );

describe("SocietyCashStatement layout regression", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the two-column statement (3 জমা + 3 খরচ header cells)", async () => {
    const { container } = renderReport();
    await waitFor(() => expect(screen.getByRole("table", { name: "সমিতির জমা ও খরচ হিসাব" })).toBeInTheDocument());
    const stmtTable = screen.getByRole("table", { name: "সমিতির জমা ও খরচ হিসাব" });
    // second header row has the 6 column headers (3 per side)
    const headerCells = within(stmtTable).getAllByText("বিবরন");
    expect(headerCells).toHaveLength(2); // one per side → symmetric two columns
    expect(container).toBeTruthy();
  });

  it("keeps signature blocks present with stable column grids", async () => {
    const { container } = renderReport();
    await waitFor(() => expect(screen.getByText("অডিট অফিসার")).toBeInTheDocument());
    const signBlocks = container.querySelectorAll(".bn-sign-block");
    expect(signBlocks.length).toBeGreaterThanOrEqual(2);
    // four signature roles render in a 4-column grid
    const fourCol = container.querySelector(".bn-sign-block.grid-cols-4");
    expect(fourCol).toBeTruthy();
    ["অডিট অফিসার", "সভাপতি", "সম্পাদক", "কোষাধক্ষ্য"].forEach((role) => {
      expect(within(fourCol as HTMLElement).getByText(role)).toBeInTheDocument();
    });
  });

  it("makes drill-down links non-interactive in print mode via print classes", async () => {
    renderReport();
    await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0));
    const labelled = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-label"));
    expect(labelled.length).toBeGreaterThanOrEqual(1);
    labelled.forEach((l) => {
      expect(l.className).toContain("print:pointer-events-none");
    });
  });
});
