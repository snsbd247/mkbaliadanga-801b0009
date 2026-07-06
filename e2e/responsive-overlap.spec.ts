/**
 * Responsive overlap audit
 * ------------------------
 * Visits every routed page across mobile/tablet/desktop viewports,
 * detects horizontal overflow / sibling overlap, screenshots, and
 * writes a JSON report consumed by `scripts/responsive-report.mjs`.
 *
 * Required env:
 *   E2E_BASE_URL   – preview / localhost URL
 *   E2E_EMAIL      – staff or admin account (skip-able for public-only run)
 *   E2E_PASSWORD
 *
 * Usage:
 *   npx playwright test e2e/responsive-overlap.spec.ts
 *   node scripts/responsive-report.mjs
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { name: "mobile",  width: 375,  height: 812 },
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  // Common desktop widths — guard report/cashbook headers against overlap
  { name: "hd-1280",  width: 1280, height: 900 },
  { name: "hd-1440",  width: 1440, height: 900 },
  { name: "fhd-1920", width: 1920, height: 1080 },
] as const;

// Public pages always testable
const PUBLIC_ROUTES = ["/", "/auth", "/farmer/dashboard"];

// Authenticated app routes (subset; safe GET-only pages)
const PRIVATE_ROUTES = [
  "/admin", "/dashboard", "/farmers", "/voters", "/payments", "/savings",
  "/loans", "/loans/plans", "/share-collection", "/irrigation", "/irrigation/rates",
  "/reports", "/reports/collections", "/reports/irrigation-due", "/reports/expenses",
  "/cashbook", "/statement", "/dues", "/dues-audit", "/accounts", "/ledger",
  "/financial-reports", "/finance-summary", "/users", "/settings", "/sms-settings",
  "/sms-logs", "/locations", "/seasons", "/offices", "/profile",
  "/admin/bulk-cards", "/admin/receipt-template", "/admin/loan-receipt-settings",
  "/admin/card-designer", "/admin/reconciliation", "/admin/share-capital-reconciliation",
  "/admin/qr-rotation", "/admin/duplicate-receipts", "/admin/farmer-login-audit",
  "/admin/demo-manager", "/admin/id-review", "/admin/developer-updates",
  "/import", "/farmers/import",
];

const OUT_DIR = path.resolve("test-results/responsive");
fs.mkdirSync(OUT_DIR, { recursive: true });
const reportPath = path.join(OUT_DIR, "report.json");
const issues: any[] = [];

const HAS_AUTH = !!(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
const ROUTES = HAS_AUTH ? [...PUBLIC_ROUTES, ...PRIVATE_ROUTES] : PUBLIC_ROUTES;

async function login(page: Page) {
  await page.goto("/auth", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', process.env.E2E_EMAIL!);
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 15_000 }).catch(() => {});
}

// Detect overflow / overlap inside the page DOM
async function detectIssues(page: Page) {
  return await page.evaluate(() => {
    const results: { kind: string; selector: string; detail: string }[] = [];
    const cssPath = (el: Element) => {
      const parts: string[] = [];
      let cur: Element | null = el;
      let depth = 0;
      while (cur && depth < 4) {
        const tag = cur.tagName.toLowerCase();
        const cls = (cur.className && typeof cur.className === "string")
          ? "." + cur.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
        parts.unshift(tag + cls);
        cur = cur.parentElement;
        depth++;
      }
      return parts.join(" > ");
    };
    const docW = document.documentElement.clientWidth;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      // Horizontal overflow beyond viewport
      const r = el.getBoundingClientRect();
      if (r.right > docW + 1 && r.width > 4) {
        results.push({ kind: "viewport-overflow", selector: cssPath(el),
          detail: `right=${Math.round(r.right)} > viewport=${docW}` });
      }
      // Element scrollable but not marked overflow-auto/scroll
      if (el.scrollWidth > el.clientWidth + 1 &&
          !["auto","scroll"].includes(cs.overflowX) &&
          el.tagName !== "BODY" && el.tagName !== "HTML") {
        results.push({ kind: "content-clipped", selector: cssPath(el),
          detail: `scrollW=${el.scrollWidth} clientW=${el.clientWidth}` });
      }
    });
    // Dedupe identical
    const seen = new Set<string>();
    return results.filter((r) => {
      const k = r.kind + "|" + r.selector;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 30);
  });
}

test.describe.configure({ mode: "serial" });

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeAll(async () => { /* placeholder */ });

    for (const route of ROUTES) {
      test(`audit ${route}`, async ({ page }) => {
        if (HAS_AUTH && PRIVATE_ROUTES.includes(route)) {
          await login(page);
        }
        await page.goto(route, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(800); // settle async UI
        const found = await detectIssues(page);
        const safe = route.replace(/[^a-z0-9]+/gi, "_") || "_root";
        const file = `${safe}__${vp.name}.png`;
        await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true });
        issues.push({ route, viewport: vp.name, screenshot: file, issues: found });
        // Don't fail — this is an audit. Hard fail only on viewport overflow > 5
        const hard = found.filter((i: any) => i.kind === "viewport-overflow");
        expect.soft(hard.length, `Viewport overflow on ${route} @ ${vp.name}`).toBeLessThanOrEqual(5);
      });
    }
  });
}

test.afterAll(async () => {
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(),
    hasAuth: HAS_AUTH, viewports: VIEWPORTS, results: issues }, null, 2));
  // eslint-disable-next-line no-console
  console.log(`\n📋 Responsive audit JSON → ${reportPath} (${issues.length} entries)`);
});
