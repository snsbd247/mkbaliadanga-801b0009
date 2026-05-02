import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "../AppLayout";

// Force unauthenticated state via the auth hook
vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn(), roles: [] }),
}));
vi.mock("@/i18n/LanguageProvider", () => ({
  useLang: () => ({ lang: "en", setLang: vi.fn(), t: (k: string) => k }),
}));
vi.mock("@/lib/branding", () => ({
  useBranding: () => ({ company_name: "Test", company_name_bn: "টে", logo_url: null }),
}));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));

describe("AppLayout protected route", () => {
  it("redirects unauthenticated users from protected admin route to /auth", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/admin" element={<div>ADMIN_HOME</div>} />
          </Route>
          <Route path="/auth" element={<div>AUTH_PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("AUTH_PAGE")).toBeInTheDocument());
    expect(screen.queryByText("ADMIN_HOME")).not.toBeInTheDocument();
  });
});
