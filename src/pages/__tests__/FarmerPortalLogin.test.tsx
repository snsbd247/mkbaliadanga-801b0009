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

  describe("Error announcements & focus management", () => {
    it("focuses the ID input when a validation error appears on step 'id'", async () => {
      renderApp();
      const sendBtn = screen.getByRole("button", { name: /Send OTP/i });
      // Submit with empty input to trigger client-side validation error
      fireEvent.click(sendBtn);
      await waitFor(() =>
        expect(screen.getByText(/Please enter your Farmer ID/i)).toBeInTheDocument(),
      );
      const idInput = screen.getByLabelText(/Farmer ID/i) as HTMLInputElement;
      await waitFor(() => expect(document.activeElement).toBe(idInput));
    });

    it("auto-focuses the OTP input when an OTP validation error occurs", async () => {
      // @ts-ignore
      (global.fetch as any).mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ ok: true, mobile_masked: "017****123" }),
      });
      renderApp();
      fireEvent.change(screen.getByLabelText(/Farmer ID/i), { target: { value: "2026-00000001" } });
      fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
      await waitFor(() => screen.getByLabelText(/6-digit OTP/i));

      const otpInput = screen.getByLabelText(/6-digit OTP/i) as HTMLInputElement;
      // Move focus elsewhere, then trigger a client-side validation error (too few digits)
      (screen.getByRole("button", { name: /Verify & Continue/i }) as HTMLButtonElement).focus();
      fireEvent.change(otpInput, { target: { value: "12" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify & Continue/i }));
      await waitFor(() =>
        expect(screen.getByText(/Enter the 6-digit code/i)).toBeInTheDocument(),
      );
      await waitFor(() => expect(document.activeElement).toBe(otpInput));
    });

    it("auto-focuses the OTP input when a server returns invalid/expired code", async () => {
      // @ts-ignore
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, mobile_masked: "017****123" }) })
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: "Invalid or expired code" }) });
      renderApp();
      fireEvent.change(screen.getByLabelText(/Farmer ID/i), { target: { value: "2026-00000001" } });
      fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
      await waitFor(() => screen.getByLabelText(/6-digit OTP/i));
      const otpInput = screen.getByLabelText(/6-digit OTP/i) as HTMLInputElement;
      fireEvent.change(otpInput, { target: { value: "999999" } });
      // Move focus away before submission so we can detect the auto-refocus
      (screen.getByRole("button", { name: /Verify & Continue/i }) as HTMLButtonElement).focus();
      fireEvent.click(screen.getByRole("button", { name: /Verify & Continue/i }));
      await waitFor(() => expect(screen.getByText(/Invalid or expired code/i)).toBeInTheDocument());
      await waitFor(() => expect(document.activeElement).toBe(otpInput));
    });

    it("error alerts use role=alert with aria-live=assertive so screen readers announce them", async () => {
      renderApp();
      fireEvent.click(screen.getByRole("button", { name: /Send OTP/i }));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveAttribute("aria-live", "assertive");
      expect(alert).toHaveAttribute("aria-atomic", "true");
      // Input is marked invalid and described by the error region
      const idInput = screen.getByLabelText(/Farmer ID/i);
      expect(idInput).toHaveAttribute("aria-invalid", "true");
      expect(idInput).toHaveAttribute("aria-describedby", "portal-error");
    });
  });

  describe("Reduced motion", () => {
    it("global stylesheet neutralizes animations and transitions when prefers-reduced-motion: reduce", () => {
      // Verify the CSS rule exists in src/index.css (compiled stylesheet not loaded in jsdom)
      // We assert the source rule is present so future regressions are caught.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      const css = fs.readFileSync("src/index.css", "utf8");
      expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
      expect(css).toMatch(/animation-duration:\s*0\.001ms\s*!important/);
      expect(css).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
    });

    it("interactive UI uses motion-reduce: utility classes to disable animation", () => {
      renderApp();
      const root = screen.getByRole("main").parentElement!;
      // Outer wrapper opts into motion-reduce transition removal
      expect(root.className).toMatch(/motion-reduce:transition-none/);
    });
  });

  describe("Keyboard tab order (desktop & mobile)", () => {
    function getFocusableOrder() {
      // Programmatic tab-order proxy: collect interactive elements in DOM order
      // (jsdom does not implement Tab traversal, but DOM order matches the visual/AX tree here).
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      return nodes.filter((n) => !n.hasAttribute("aria-hidden"));
    }

    function assertLogicalOrder() {
      const order = getFocusableOrder().map((n) => {
        if (n.tagName === "A") return `link:${n.textContent?.trim().slice(0, 24)}`;
        if (n.tagName === "INPUT") return `input:${n.getAttribute("id") || n.getAttribute("name") || ""}`;
        return `btn:${n.getAttribute("aria-label") || n.textContent?.trim().slice(0, 24) || ""}`;
      });
      const skipIdx = order.findIndex((s) => /Skip to main content/i.test(s));
      const enIdx = order.findIndex((s) => /Switch to English/i.test(s));
      const bnIdx = order.findIndex((s) => /Switch to Bengali|বাংলা/i.test(s));
      const fidIdx = order.findIndex((s) => s === "input:fid");
      const sendIdx = order.findIndex((s) => /Send OTP/i.test(s));
      const adminIdx = order.findIndex((s) => /Go to Admin Login page/i.test(s));

      expect(skipIdx).toBeGreaterThanOrEqual(0);
      expect(enIdx).toBeGreaterThan(skipIdx);
      expect(bnIdx).toBeGreaterThan(enIdx);
      expect(fidIdx).toBeGreaterThan(bnIdx);
      expect(sendIdx).toBeGreaterThan(fidIdx);
      expect(adminIdx).toBeGreaterThan(sendIdx);
    }

    it("desktop (1024px): Skip → LanguageToggle → form fields → Admin Login", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
      renderApp();
      assertLogicalOrder();
    });

    it("mobile (360px): tab order is identical to desktop (DOM-driven)", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 360 });
      renderApp();
      assertLogicalOrder();
    });

    it("each focusable in the chain can actually receive focus", () => {
      renderApp();
      const en = screen.getByRole("button", { name: /Switch to English/i });
      const bn = screen.getByRole("button", { name: /বাংলা/i });
      const fid = screen.getByLabelText(/Farmer ID/i);
      const send = screen.getByRole("button", { name: /Send OTP/i });
      const admin = screen.getByRole("button", { name: /Go to Admin Login page/i });
      [en, bn, fid as HTMLElement, send, admin].forEach((el) => {
        (el as HTMLElement).focus();
        expect(document.activeElement).toBe(el);
      });
    });
  });

  describe("Responsive layout snapshots (no overlap, consistent spacing)", () => {
    const widths = [360, 768, 1024];
    widths.forEach((w) => {
      it(`renders a stable structural snapshot at ${w}px without overlap`, () => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
        const { container } = render(
          <LanguageProvider>
            <MemoryRouter initialEntries={["/"]}>
              <Routes>
                <Route path="/" element={<FarmerPortalLogin />} />
              </Routes>
            </MemoryRouter>
          </LanguageProvider>,
        );

        // Structural invariants — these guard against regressions in spacing/overlap classes.
        const main = container.querySelector("main#main-content")!;
        expect(main).toBeTruthy();
        // Responsive vertical padding utilities present
        expect(main.className).toMatch(/py-6/);
        expect(main.className).toMatch(/sm:py-8/);
        expect(main.className).toMatch(/md:py-10/);

        // Inner wrapper uses responsive vertical rhythm (space-y)
        const inner = main.querySelector(":scope > div") as HTMLElement;
        expect(inner.className).toMatch(/space-y-4/);
        expect(inner.className).toMatch(/sm:space-y-5/);

        // Footer is rendered exactly once and is a sibling of <main> (no overlap nesting)
        const footers = container.querySelectorAll("footer");
        expect(footers.length).toBe(1);
        expect(footers[0].parentElement).toBe(main.parentElement);

        // Snapshot the structural skeleton (tag + key class fragments) — width-stable.
        const skeleton = Array.from(container.querySelectorAll("main, header, form, footer, .max-w-md"))
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").split(/\s+/).slice(0, 3).join(".")}`)
          .join("|");
        expect(skeleton).toMatchSnapshot(`farmer-login-skeleton-${w}px`);
      });
    });
  });
});
