import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageProvider";

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    officeId: "office-1",
    isAdmin: true,
    isSuper: true,
    user: { id: "u1" },
  }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const insertCalls: any[] = [];
const seasons = [{ id: "s1", name: "Boro 2025", year: 2025, type: "boro" }];
const ratesRows: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const fromImpl = (table: string) => {
    const api: any = {
      select: () => api,
      eq: () => api,
      order: () => {
        if (table === "seasons") return Promise.resolve({ data: seasons, error: null });
        if (table === "irrigation_rates") return Promise.resolve({ data: ratesRows, error: null });
        return Promise.resolve({ data: [], error: null });
      },
      insert: (payload: any) => {
        insertCalls.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    return api;
  };
  return { supabase: { from: fromImpl } };
});

import IrrigationRates from "../IrrigationRates";

function renderPage() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <IrrigationRates />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe("IrrigationRates", () => {
  beforeEach(() => {
    insertCalls.length = 0;
  });

  it("renders empty state and opens add dialog", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Irrigation Rates/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Add New|নতুন/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("validates required season and base rate", async () => {
    const { toast } = await import("sonner");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Add New|নতুন/i }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: /^Save|সংরক্ষণ/i }));
    await waitFor(() => expect((toast as any).error).toHaveBeenCalled());
    expect(insertCalls.length).toBe(0);
  });
});
