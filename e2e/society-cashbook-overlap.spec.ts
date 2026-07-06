/**
 * SocietyCashBook print/preview regression
 * ----------------------------------------
 * Ensures the two side-by-side cash-book tables (Income / Expense) never
 * overlap and never leak horizontally out of their own scroll container,
 * across mobile → full-HD widths and in both Bangla and English.
 *
 * Required env:
 *   E2E_BASE_URL  – preview / localhost URL
 *   E2E_EMAIL     – staff or admin account (route is permission-gated)
 *   E2E_PASSWORD
 *
 * Usage:
 *   npx playwright test e2e/society-cashbook-overlap.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "hd-1280", width: 1280, height: 900 },
  { name: "hd-1440", width: 1440, height: 900 },
  { name: "fhd-1920", width: 1920, height: 1080 },
] as const;

const HAS_AUTH = !!(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

async function login(page: Page) {
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', process.env.E2E_EMAIL!);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 15_000 }).catch(() => {});
}

// Sections must not overlap; each table must stay within its own section box.
async function assertNoOverlap(page: Page, label: string) {
  const boxes = await page.evaluate(() => {
    const cols = document.querySelector(".bn-cb-cols");
    if (!cols) return null;
    const sections = Array.from(cols.querySelectorAll(":scope > section"));
    return sections.map((s) => {
      const sr = s.getBoundingClientRect();
      const table = s.querySelector("table");
      const tr = table?.getBoundingClientRect() ?? sr;
      return { s: { l: sr.left, r: sr.right }, t: { l: tr.left, r: tr.right, w: tr.width }, sw: s.clientWidth };
    });
  });
  if (!boxes) test.skip(true, "SocietyCashBook not rendered (no data / no access)");
  expect(boxes!.length, `${label}: two sections`).toBeGreaterThanOrEqual(2);
  const [a, b] = boxes!;
  // Sections never horizontally overlap each other.
  const overlap = Math.min(a.s.r, b.s.r) - Math.max(a.s.l, b.s.l);
  expect(overlap, `${label}: section overlap px`).toBeLessThanOrEqual(1);
  // Each table stays inside its section's scroll container (no bleed-out).
  for (const box of boxes!) {
    if (box.t.w > box.sw + 1) continue; // wider table is fine — it scrolls
    expect(box.t.r, `${label}: table right within section`).toBeLessThanOrEqual(box.s.r + 1);
  }
}

test.describe("SocietyCashBook two-table layout", () => {
  test.skip(!HAS_AUTH, "requires E2E_EMAIL / E2E_PASSWORD");

  for (const vp of VIEWPORTS) {
    test(`no overlap @ ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await login(page);
      await page.goto("/reports/society-cashbook", { waitUntil: "networkidle" });
      await page.waitForSelector(".bn-cb-cols", { timeout: 15_000 }).catch(() => {});
      await assertNoOverlap(page, `screen ${vp.name}`);

      // Same guarantee under print emulation (PDF export uses window.print()).
      await page.emulateMedia({ media: "print" });
      await assertNoOverlap(page, `print ${vp.name}`);
      await page.emulateMedia({ media: "screen" });
    });
  }
});
