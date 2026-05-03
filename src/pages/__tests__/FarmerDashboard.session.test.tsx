import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FarmerDashboard from "../FarmerDashboard";
import { LanguageProvider } from "@/i18n/LanguageProvider";

vi.mock("@/lib/branding", () => ({
  useBranding: () => ({ company_name: "Test", company_name_bn: "টে", logo_url: null }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderApp() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/farmer/dashboard"]}>
        <Routes>
          <Route path="/" element={<div>LOGIN_PAGE</div>} />
          <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe("FarmerDashboard session guard", () => {
  beforeEach(() => {
    localStorage.clear();
    // @ts-ignore
    global.fetch = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("redirects to / when no farmer_portal_token", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText("LOGIN_PAGE")).toBeInTheDocument());
    // Should not have called the API
    // @ts-ignore
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("redirects to / and clears token when expires_at is in the past", async () => {
    localStorage.setItem("farmer_portal_token", "a".repeat(64));
    localStorage.setItem("farmer_portal_expires", new Date(Date.now() - 1000).toISOString());
    renderApp();
    await waitFor(() => expect(screen.getByText("LOGIN_PAGE")).toBeInTheDocument());
    expect(localStorage.getItem("farmer_portal_token")).toBeNull();
    // @ts-ignore
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
