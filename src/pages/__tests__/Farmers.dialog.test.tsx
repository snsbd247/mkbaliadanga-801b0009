import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageProvider";

// Mocks ---------------------------------------------------------------
vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ officeId: "office-1", isSuper: true, user: { id: "u1" } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// LocationPicker stub — exposes buttons to set/clear all 7 levels at once
vi.mock("@/components/locations/LocationPicker", () => ({
  LocationPicker: ({ value, onChange }: any) => (
    <div data-testid="loc-picker">
      <span data-testid="loc-state">{Object.values(value).filter(Boolean).length}</span>
      <button
        type="button"
        onClick={() =>
          onChange({
            division_id: "d", district_id: "di", upazila_id: "u",
            union_id: "un", ward_id: "w", village_id: "v", mouza_id: "m",
          })
        }
      >
        fill-locations
      </button>
    </div>
  ),
}));

// Configurable insert resolver to test double-submit prevention
let insertResolver: ((v: any) => void) | null = null;
const insertCalls: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const fromImpl = (table: string) => {
    const list: any[] = [];
    const api: any = {
      select: () => api,
      eq: () => api,
      order: () => api,
      range: () => Promise.resolve({ data: list, error: null }),
      or: () => api,
      insert: (payload: any) => {
        insertCalls.push({ table, payload });
        return {
          select: () => ({
            single: () =>
              new Promise((res) => {
                insertResolver = (v) =>
                  res(v ?? { data: { id: "new-id", ...payload }, error: null });
              }),
          }),
        };
      },
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      then: (resolve: any) => Promise.resolve({ data: list, error: null }).then(resolve),
    };
    return api;
  };
  return {
    supabase: {
      from: fromImpl,
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "x" } }),
        }),
      },
    },
  };
});

import Farmers from "../Farmers";

function renderPage() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Farmers />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe("Farmers Add/Edit dialog", () => {
  beforeEach(() => {
    insertResolver = null;
    insertCalls.length = 0;
  });

  it("opens the Add dialog on trigger click", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Add New|নতুন/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("loc-picker")).toBeInTheDocument();
  });

  it("closes the dialog and resets cascade + inputs", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Add New|নতুন/i }));
    await screen.findByRole("dialog");

    // Fill name + locations
    const nameInput = document.querySelector('input[maxlength="100"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Farmer X" } });
    fireEvent.click(screen.getByText("fill-locations"));
    expect(screen.getByTestId("loc-state").textContent).toBe("7");

    // Cancel
    fireEvent.click(screen.getByRole("button", { name: /Cancel|বাতিল/i }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    // Re-open — state should be cleared
    fireEvent.click(screen.getByRole("button", { name: /Add New|নতুন/i }));
    await screen.findByRole("dialog");
    expect(screen.getByTestId("loc-state").textContent).toBe("0");
    const nameInput2 = document.querySelector('input[maxlength="100"]') as HTMLInputElement;
    expect(nameInput2.value).toBe("");
  });

  it("prevents double submit while saving", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Add New|নতুন/i }));
    await screen.findByRole("dialog");

    const nameInput = document.querySelector('input[maxlength="100"]') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Farmer X" } });
    fireEvent.click(screen.getByText("fill-locations"));

    const saveBtn = screen.getByRole("button", { name: /^Save|সংরক্ষণ/i });
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);

    // Wait for the in-flight insert to register, then resolve it
    await waitFor(() => expect(insertCalls.length).toBeGreaterThan(0));
    expect(saveBtn).toBeDisabled();
    const liveName = document.querySelector('input[maxlength="100"]') as HTMLInputElement;
    expect(liveName).toBeDisabled();

    await act(async () => {
      insertResolver?.({ data: { id: "new-id" }, error: null });
    });

    // Only ONE insert despite three clicks
    expect(insertCalls.filter((c) => c.table === "farmers").length).toBe(1);
  });
});
