import { test, expect } from "@playwright/test";

/**
 * Smoke test: Payments, Approvals, Reports pages load without crashing.
 *
 * Prerequisites:
 *   E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason = (!EMAIL || !PASSWORD) ? "E2E credentials not configured" : null;

test.describe("Smoke: Payments / Approvals / Reports", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in|লগ ?ইন/i }).click();
    await page.waitForURL(/\/admin|\/dashboard|\/$/, { timeout: 15_000 });
  });

  for (const { path, marker } of [
    { path: "/payments", marker: /payment|পেমেন্ট/i },
    { path: "/approvals", marker: /approval|অনুমোদন/i },
    { path: "/reports", marker: /report|রিপোর্ট/i },
  ]) {
    test(`loads ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });

      await page.goto(`${BASE}${path}`);
      await expect(page.locator("body")).toContainText(marker, { timeout: 10_000 });

      // No fatal page crash / runtime error
      const fatal = errors.filter(
        (e) =>
          !/favicon|net::ERR|ResizeObserver|hydrat|extension/i.test(e) &&
          !/Failed to load resource/i.test(e),
      );
      expect(fatal, `runtime errors on ${path}:\n${fatal.join("\n")}`).toEqual([]);
    });
  }
});
