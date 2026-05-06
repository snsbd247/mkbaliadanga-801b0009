import { test, expect } from "@playwright/test";

/**
 * Smoke test: verify both Bangla and English render core labels on key pages.
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = (!EMAIL || !PASSWORD) ? "E2E credentials not configured" : null;

const PAGES: { path: string; en: string; bn: string }[] = [
  { path: "/admin",        en: "Dashboard",       bn: "ড্যাশবোর্ড" },
  { path: "/farmers",      en: "Farmers",         bn: "কৃষক" },
  { path: "/offices",      en: "Offices",         bn: "অফিস" },
  { path: "/loans",        en: "Loans",           bn: "ঋণ" },
  { path: "/irrigation",   en: "Irrigation",      bn: "সেচ" },
  { path: "/loans/plans",  en: "Loan Plans",      bn: "ঋণ প্ল্যান" },
];

async function setLang(page: any, lang: "en" | "bn") {
  await page.evaluate((l: string) => localStorage.setItem("lang", l), lang);
}

test.describe("i18n smoke", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  for (const lang of ["en", "bn"] as const) {
    test(`core pages render in ${lang}`, async ({ page }) => {
      await setLang(page, lang);
      for (const p of PAGES) {
        await page.goto(p.path);
        const expected = lang === "en" ? p.en : p.bn;
        await expect(page.locator("body")).toContainText(expected, { timeout: 10_000 });
      }
    });
  }
});
