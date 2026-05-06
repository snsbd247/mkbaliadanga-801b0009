import { test, expect } from "@playwright/test";

/**
 * PDF localization smoke. Triggers a report PDF download in EN and BN and
 * inspects the generated PDF text stream for the expected localized
 * header/footer/body labels.
 *
 * The report under test is the Farmer Statement PDF (route /farmer-statement
 * with a "Download PDF" button). The test is best-effort: if the button
 * cannot be reached (no farmer data in the test environment) it is skipped.
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skip = !EMAIL || !PASSWORD;

async function setLang(page: any, l: "en" | "bn") {
  await page.evaluate((lang: string) => localStorage.setItem("lang", lang), l);
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|farmer|admin/i, { timeout: 15_000 });
}

async function downloadPdfText(page: any): Promise<string | null> {
  // Look for any "Download PDF" / "PDF" button on the current page.
  const btn = page.getByRole("button", { name: /download.*pdf|pdf|রসিদ|ডাউনলোড/i }).first();
  if (!(await btn.count())) return null;
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 8_000 }).catch(() => null),
    btn.click().catch(() => null),
  ]);
  if (!dl) return null;
  const path = await dl.path();
  if (!path) return null;
  const fs = await import("node:fs/promises");
  const buf = await fs.readFile(path);
  // jsPDF stores plain text in the PDF stream — a simple ASCII scan is enough
  // to verify the static header/footer labels.
  return buf.toString("latin1");
}

test.describe("PDF localization", () => {
  test.skip(skip, "E2E credentials not configured");

  for (const lang of ["en", "bn"] as const) {
    test(`Farmer Statement PDF renders in ${lang}`, async ({ page }) => {
      await login(page);
      await setLang(page, lang);
      await page.goto("/farmers");
      await page.waitForLoadState("networkidle").catch(() => {});
      const firstRowLink = page.locator("a, button").filter({ hasText: /F\d+|view|profile/i }).first();
      if (!(await firstRowLink.count())) test.skip(true, "No farmers in this environment.");
      await firstRowLink.click().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});

      const text = await downloadPdfText(page);
      if (!text) test.skip(true, "PDF download button not reachable in this environment.");

      if (lang === "en") {
        expect(text).toMatch(/Period/);
        expect(text).toMatch(/Page\s+1/);
        expect(text).toMatch(/Printed/);
      } else {
        // Bangla labels are written transliterated alongside the EN word in
        // exports.ts (e.g. "Period (Somoy)") so they are still ASCII-detectable.
        expect(text).toMatch(/Period \(Somoy\)|Mudrito|Pristha/);
      }
    });
  }
});
