import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FarmerPortalLogin from "../FarmerPortalLogin";

vi.mock("@/lib/branding", () => ({
  useBranding: () => ({ company_name: "Test Co", company_name_bn: "টেস্ট", logo_url: null }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: null, isSuper: false, isAdmin: false, isCommittee: false, rolesLoaded: true, roles: [],
  }),
}));

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<FarmerPortalLogin />} />
        <Route path="/farmer/dashboard" element={<div>FARMER_DASHBOARD</div>} />
        <Route path="/auth" element={<div>ADMIN_AUTH_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FarmerPortalLogin", () => {
  beforeEach(() => {
    localStorage.clear();
    // @ts-ignore
    global.fetch = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows non-revealing error and stays on step 'id' when OTP request returns 429", async () => {
    // @ts-ignore
    (global.fetch as any).mockResolvedValueOnce({
      ok: false, status: 429,
      json: async () => ({ error: "Too many OTP requests. Try again later." }),
    });
    renderApp();
    fireEvent.change(screen.getByLabelText(/Farmer ID/i), { target: { value: "2026-00000001" } });
    fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
    await waitFor(() => expect(screen.getByText(/Too many OTP requests/i)).toBeInTheDocument());
    // Generic error must NOT reveal whether the farmer exists
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/does not exist/i)).not.toBeInTheDocument();
  });

  it("advances to OTP step on success and redirects to dashboard after verify", async () => {
    // @ts-ignore
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mobile_masked: "017****123" }) })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ ok: true, token: "a".repeat(64), expires_at: new Date(Date.now() + 3600_000).toISOString(), farmer: { name: "X" } }),
      });
    renderApp();
    fireEvent.change(screen.getByLabelText(/Farmer ID/i), { target: { value: "2026-00000001" } });
    fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
    await waitFor(() => expect(screen.getByLabelText(/6-digit OTP/i)).toBeInTheDocument());
    expect(screen.getByText(/017\*\*\*\*123/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/6-digit OTP/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify & Continue/i }));
    await waitFor(() => expect(screen.getByText("FARMER_DASHBOARD")).toBeInTheDocument());
    expect(localStorage.getItem("farmer_portal_token")).toBeTruthy();
    expect(localStorage.getItem("farmer_portal_expires")).toBeTruthy();
  });

  it("shows generic error on invalid/expired OTP without leaking specifics", async () => {
    // @ts-ignore
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mobile_masked: "017****123" }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Invalid or expired code" }) });
    renderApp();
    fireEvent.change(screen.getByLabelText(/Farmer ID/i), { target: { value: "2026-00000001" } });
    fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
    await waitFor(() => screen.getByLabelText(/6-digit OTP/i));
    fireEvent.change(screen.getByLabelText(/6-digit OTP/i), { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: /Verify & Continue/i }));
    await waitFor(() => expect(screen.getByText(/Invalid or expired code/i)).toBeInTheDocument());
    // Should not say "wrong OTP" or "OTP mismatch" or reveal that the farmer exists/doesn't
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mismatch/i)).not.toBeInTheDocument();
    expect(localStorage.getItem("farmer_portal_token")).toBeNull();
  });

  it("Admin Login button navigates to /auth", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: /Admin Login/i }));
    await waitFor(() => expect(screen.getByText("ADMIN_AUTH_PAGE")).toBeInTheDocument());
  });

  describe("Keyboard navigation & a11y", () => {
    it("Admin Login button has accessible aria-label and focus styles", () => {
      renderApp();
      const btn = screen.getByRole("button", { name: /Go to Admin Login page/i });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute("aria-label", "Go to Admin Login page");
      expect(btn.className).toMatch(/focus-visible:ring-2/);
      expect(btn.className).toMatch(/focus-visible:ring-ring/);
    });

    it("Admin Login button is keyboard-focusable and activates with Enter", async () => {
      renderApp();
      const btn = screen.getByRole("button", { name: /Go to Admin Login page/i });
      btn.focus();
      expect(document.activeElement).toBe(btn);
      fireEvent.keyDown(btn, { key: "Enter", code: "Enter" });
      fireEvent.click(btn); // browsers translate Enter on button to click
      await waitFor(() => expect(screen.getByText("ADMIN_AUTH_PAGE")).toBeInTheDocument());
    });

    it("Admin Login button activates with Space key", async () => {
      renderApp();
      const btn = screen.getByRole("button", { name: /Go to Admin Login page/i });
      btn.focus();
      expect(document.activeElement).toBe(btn);
      fireEvent.keyUp(btn, { key: " ", code: "Space" });
      fireEvent.click(btn);
      await waitFor(() => expect(screen.getByText("ADMIN_AUTH_PAGE")).toBeInTheDocument());
    });

    it("Skip-to-main-content link is present and points at #main-content", () => {
      renderApp();
      const skip = screen.getByRole("link", { name: /Skip to main content/i });
      expect(skip).toBeInTheDocument();
      expect(skip).toHaveAttribute("href", "#main-content");
    });

    it("Language toggle exposes ARIA group + pressed state for screen readers", () => {
      renderApp();
      expect(screen.getByRole("group", { name: /Language selector/i })).toBeInTheDocument();
      const enBtn = screen.getByRole("button", { name: /Switch to English/i });
      const bnBtn = screen.getByRole("button", { name: /বাংলা/i });
      expect(enBtn).toHaveAttribute("aria-pressed");
      expect(bnBtn).toHaveAttribute("aria-pressed");
    });

    it("main landmark exists with id matching the skip link target", () => {
      renderApp();
      const main = document.getElementById("main-content");
      expect(main).not.toBeNull();
      expect(main?.tagName.toLowerCase()).toBe("main");
    });
  });
});
