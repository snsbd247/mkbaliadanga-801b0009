import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FarmerPortalLogin from "../FarmerPortalLogin";
import { LanguageProvider } from "@/i18n/LanguageProvider";

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
    <LanguageProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<FarmerPortalLogin />} />
          <Route path="/farmer/dashboard" element={<div>FARMER_DASHBOARD</div>} />
          <Route path="/auth" element={<div>ADMIN_AUTH_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

// Tests target the current id + mobile-as-password direct login flow
// (POST /farmer-password-login). No OTP step.
describe("FarmerPortalLogin (id + mobile flow)", () => {
  beforeEach(() => {
    localStorage.clear();
    // @ts-ignore
    global.fetch = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it("requires both farmer ID and mobile before submitting", async () => {
    renderApp();
    const submit = screen.getAllByRole("button").find((b) => /লগ ?ইন|login/i.test(b.textContent || ""))!;
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // No network call made
    expect((global.fetch as any)).not.toHaveBeenCalled();
  });

  it("logs in successfully and redirects to /farmer/dashboard", async () => {
    // @ts-ignore
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        token: "a".repeat(64),
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
        farmer: { name: "Test Farmer" },
      }),
    });
    renderApp();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "0000001" } });
    // Mobile is type=password (not a textbox role) — find by id
    const mob = document.getElementById("mob") as HTMLInputElement;
    fireEvent.change(mob, { target: { value: "01711111111" } });

    const form = inputs[0].closest("form")!;
    fireEvent.submit(form);

    await waitFor(() => expect(screen.getByText("FARMER_DASHBOARD")).toBeInTheDocument());
    expect(localStorage.getItem("farmer_portal_token")).toBe("a".repeat(64));
    expect(localStorage.getItem("farmer_portal_expires")).toBeTruthy();
    expect(localStorage.getItem("farmer_portal_name")).toBe("Test Farmer");
  });

  it("shows error on invalid credentials and does not store a token", async () => {
    // @ts-ignore
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid farmer ID or mobile number", attempts_remaining: 4 }),
    });
    renderApp();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "0000001" } });
    const mob = document.getElementById("mob") as HTMLInputElement;
    fireEvent.change(mob, { target: { value: "01700000000" } });
    fireEvent.submit(inputs[0].closest("form")!);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/Invalid farmer ID/i);
    expect(localStorage.getItem("farmer_portal_token")).toBeNull();
  });

  it("shows cooldown when server returns 429", async () => {
    // @ts-ignore
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many attempts. Try again later.", retry_after: 60 }),
    });
    renderApp();
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "0000001" } });
    const mob = document.getElementById("mob") as HTMLInputElement;
    fireEvent.change(mob, { target: { value: "01711111111" } });
    fireEvent.submit(inputs[0].closest("form")!);

    await waitFor(() => expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument());
    // Submit button is disabled while in cooldown
    const submitBtn = screen.getByRole("button", { name: /Locked/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("Admin Login button navigates to /auth", async () => {
    renderApp();
    const adminBtn = screen.getAllByRole("button").find((b) => /admin|অ্যাডমিন/i.test(b.getAttribute("aria-label") || b.textContent || ""))!;
    fireEvent.click(adminBtn);
    await waitFor(() => expect(screen.getByText("ADMIN_AUTH_PAGE")).toBeInTheDocument());
  });

  it("error alert is announced via role=alert with aria-live=assertive", async () => {
    renderApp();
    const submit = screen.getAllByRole("button").find((b) => /লগ ?ইন|login/i.test(b.textContent || ""))!;
    fireEvent.click(submit);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveAttribute("aria-atomic", "true");
  });

  it("skip-to-main link points at #main-content", () => {
    renderApp();
    const skip = screen.getByRole("link", { name: /skip|মূল/i });
    expect(skip).toHaveAttribute("href", "#main-content");
    const main = document.getElementById("main-content");
    expect(main?.tagName.toLowerCase()).toBe("main");
  });
});
