import { test, expect } from "@playwright/test";

/**
 * Verifies the global header MenuSearch keyboard behavior:
 *  - Ctrl+K and Cmd+K focus the input
 *  - Typing filters results
 *  - Escape closes the panel and returns focus to the previously-focused element
 *  - Ctrl+K still focuses the input when a sidebar/modal is open
 *  - aria-label is present and a focus ring is visible after Ctrl+K
 *
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL (or E2E_STAFF_EMAIL), E2E_PASSWORD
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? process.env.E2E_STAFF_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = (!EMAIL || !PASSWORD) ? "E2E credentials not configured" : null;

const SEARCH_RE = /search.*menu|মেনু/i;

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Menu Search Ctrl+K shortcut", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/admin");
  });

  test("Ctrl+K focuses input, typing filters results, Escape returns focus", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: SEARCH_RE }).first();
    await expect(search).toBeVisible();

    // Focus a known element first so we can verify focus restoration on Escape.
    const trigger = page.getByLabel("Toggle menu").first();
    await trigger.focus();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Control+K");
    await expect(search).toBeFocused();

    // aria-label must be present for screen readers
    await expect(search).toHaveAttribute("aria-label", /.+/);

    // Typing filters menu results — at least one suggestion should appear.
    await page.keyboard.type("farm");
    const suggestions = page.locator('button:has-text("M")').filter({ hasText: /farm/i });
    await expect(suggestions.first()).toBeVisible({ timeout: 5_000 });

    // Escape clears + returns focus to the previously focused element.
    await page.keyboard.press("Escape");
    await expect(search).not.toBeFocused();
    await expect(trigger).toBeFocused();
  });

  test("Cmd+K (mac) focuses the header menu search input", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: SEARCH_RE }).first();
    await page.locator("body").click();
    await page.keyboard.press("Meta+K");
    await expect(search).toBeFocused();
  });

  test("Ctrl+K still focuses Menu Search when a modal/dialog is open", async ({ page }) => {
    // Open a known dialog: Farmers page has an "Add"/"New Farmer" trigger.
    await page.goto("/farmers");
    const addBtn = page
      .getByRole("button", { name: /add|new farmer|নতুন কৃষক|যোগ/i })
      .first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      // Wait for any dialog to mount
      await page.locator('[role="dialog"]').first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    }

    await page.keyboard.press("Control+K");
    const search = page.getByRole("searchbox", { name: SEARCH_RE }).first();
    await expect(search).toBeFocused();
  });

  test("focus ring is visible for keyboard users after Ctrl+K", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: SEARCH_RE }).first();
    await page.locator("body").click();
    await page.keyboard.press("Control+K");
    await expect(search).toBeFocused();

    // After focus via keyboard, there should be a visible outline or ring.
    const outline = await search.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        outline: cs.outlineStyle + " " + cs.outlineWidth,
        boxShadow: cs.boxShadow,
      };
    });
    const hasRing =
      (outline.outline && !/none/.test(outline.outline) && !/0px/.test(outline.outline)) ||
      (outline.boxShadow && outline.boxShadow !== "none");
    expect(hasRing).toBeTruthy();
  });
});
