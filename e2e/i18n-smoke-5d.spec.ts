import { test, expect } from "@playwright/test";

/**
 * Smoke test (Phase 5d): QrRotation, VoterHistory, ShareCollection in EN+BN.
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL (super_admin), E2E_PASSWORD
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skip = !EMAIL || !PASSWORD;

const PAGES: { path: string; en: string[]; bn: string[] }[] = [
  { path: "/admin/qr-rotation",      en: ["QR", "Rotation"],          bn: ["কিউআর", "রোটেশন"] },
  { path: "/admin/voter-history",    en: ["Voter", "History"],        bn: ["ভোটার", "ইতিহাস"] },
  { path: "/share-collection",       en: ["Share Collection"],         bn: ["শেয়ার", "আদায়"] },
];

async function setLang(page: any, lang: "en" | "bn") {
  await page.evaluate((l: string) => localStorage.setItem("lang", l), lang);
}

test.describe("i18n smoke phase 5d", () => {
  test.skip(skip, "E2E credentials not configured");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard|farmer/i, { timeout: 15_000 });
  });

  for (const lang of ["en", "bn"] as const) {
    test(`renders 5d modules in ${lang}`, async ({ page }) => {
      await setLang(page, lang);
      for (const p of PAGES) {
        await page.goto(p.path);
        await page.waitForLoadState("networkidle").catch(() => {});
        const expectedTokens = lang === "en" ? p.en : p.bn;
        // At least one token from the page's localized signature must appear.
        const body = page.locator("body");
        let matched = false;
        for (const tok of expectedTokens) {
          if (await body.locator(`text=${tok}`).count() > 0) { matched = true; break; }
        }
        expect(matched, `Expected one of [${expectedTokens.join(", ")}] on ${p.path} (${lang})`).toBe(true);
      }
    });
  }
});
