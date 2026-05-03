import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lightweight integration check: ensures the Voter Audit page is
 * registered in the router and surfaced in the sidebar so role-gated
 * navigation never silently breaks.
 */
describe("Voter Audit wiring", () => {
  it("registers /reports/voter-audit route protected by RequirePerm", () => {
    const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
    expect(app).toMatch(/import VoterAudit from ["']\.\/pages\/VoterAudit["']/);
    expect(app).toMatch(
      /<Route\s+path=["']\/reports\/voter-audit["'][\s\S]*?RequirePerm[\s\S]*?VoterAudit/
    );
  });

  it("exposes a sidebar link to /reports/voter-audit", () => {
    const sidebar = readFileSync(
      resolve(__dirname, "../../components/layout/AppSidebar.tsx"),
      "utf8"
    );
    expect(sidebar).toMatch(/url:\s*["']\/reports\/voter-audit["']/);
    expect(sidebar).toMatch(/Voter Audit/);
  });
});
