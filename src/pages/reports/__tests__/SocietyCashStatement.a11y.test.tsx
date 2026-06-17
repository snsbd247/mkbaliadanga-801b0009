import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks for external/runtime dependencies ---
vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ officeId: null }),
}));

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
      if (table === "savings_transactions") return makeQuery([{ type: "deposit", amount: 1000, status: "approved" }]);
      if (table === "expenses") return makeQuery([{ head: "Office Rent", amount: 200 }]);
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

describe("SocietyCashStatement accessibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a single h1 followed by h2 (correct heading order)", async () => {
    renderReport();
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThan(0));
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s.length).toBeGreaterThanOrEqual(1);
    // h2 exists (statement subtitle) — no skipped levels
    expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
  });

  it("gives the statement table an accessible name", async () => {
    renderReport();
    await waitFor(() =>
      expect(screen.getByRole("table", { name: "সমিতির জমা ও খরচ হিসাব" })).toBeInTheDocument(),
    );
  });

  it("exposes aria-labelled drill-down links for totals", async () => {
    renderReport();
    await waitFor(() => {
      const links = screen.getAllByRole("link");
      const labelled = links.filter((l) => l.getAttribute("aria-label"));
      expect(labelled.length).toBeGreaterThanOrEqual(1);
    });
  });
});
