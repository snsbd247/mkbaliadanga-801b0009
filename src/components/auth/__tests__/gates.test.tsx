import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── Mock auth context ──────────────────────────────────────────────
const authState: any = {};
vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => authState,
}));

// Avoid pulling the i18n provider into the test tree.
vi.mock("@/i18n/LanguageProvider", () => ({
  useLang: () => ({ lang: "en", t: (k: string) => k }),
}));

import { RequireDeveloper } from "../RequireDeveloper";
import { RequireRole } from "../RequireRole";

function setAuth(partial: Record<string, unknown>) {
  Object.keys(authState).forEach((k) => delete authState[k]);
  Object.assign(authState, {
    rolesLoaded: true,
    roles: [],
    isDeveloper: false,
    isSuper: false,
    isSuperAdmin: false,
    isAdmin: false,
    isCommittee: false,
    ...partial,
  });
}

const renderGate = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const Child = () => <div>SECRET_CONTENT</div>;

describe("RequireDeveloper", () => {
  beforeEach(() => setAuth({}));

  it("blocks a plain user", () => {
    setAuth({ roles: ["staff"] });
    renderGate(<RequireDeveloper><Child /></RequireDeveloper>);
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
    expect(screen.getByText("Developer only")).toBeInTheDocument();
  });

  it("blocks a super_admin (developer-only)", () => {
    setAuth({ roles: ["super_admin"], isSuper: true, isSuperAdmin: true });
    renderGate(<RequireDeveloper><Child /></RequireDeveloper>);
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });

  it("allows a developer", () => {
    setAuth({ roles: ["developer"], isDeveloper: true, isSuper: true, isSuperAdmin: true });
    renderGate(<RequireDeveloper><Child /></RequireDeveloper>);
    expect(screen.getByText("SECRET_CONTENT")).toBeInTheDocument();
  });

  it("shows loading until roles resolve", () => {
    setAuth({ rolesLoaded: false });
    renderGate(<RequireDeveloper><Child /></RequireDeveloper>);
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });
});

describe("RequireRole", () => {
  beforeEach(() => setAuth({}));

  it("allows a matching role", () => {
    setAuth({ roles: ["admin"], isAdmin: true });
    renderGate(<RequireRole roles={["admin", "super_admin"]}><Child /></RequireRole>);
    expect(screen.getByText("SECRET_CONTENT")).toBeInTheDocument();
  });

  it("denies a non-matching role", () => {
    setAuth({ roles: ["staff"] });
    renderGate(<RequireRole roles={["admin", "super_admin"]}><Child /></RequireRole>);
    expect(screen.queryByText("SECRET_CONTENT")).toBeNull();
  });

  it("super_admin always passes", () => {
    setAuth({ roles: ["super_admin"], isSuper: true, isSuperAdmin: true });
    renderGate(<RequireRole roles={["committee"]}><Child /></RequireRole>);
    expect(screen.getByText("SECRET_CONTENT")).toBeInTheDocument();
  });

  it("developer always passes", () => {
    setAuth({ roles: ["developer"], isDeveloper: true, isSuper: true, isSuperAdmin: true });
    renderGate(<RequireRole roles={["committee"]}><Child /></RequireRole>);
    expect(screen.getByText("SECRET_CONTENT")).toBeInTheDocument();
  });
});
