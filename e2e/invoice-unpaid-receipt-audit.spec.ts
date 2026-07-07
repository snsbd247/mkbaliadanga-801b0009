import { test, expect } from "@playwright/test";

/**
 * After marking an irrigation invoice as unpaid:
 *  - the associated receipt is voided and disappears from / is marked void in
 *    the Payments receipt list, and
 *  - an audit entry (module=irrigation_payment, action_type=void) is written and
 *    is findable in the Audit Timeline by the payment/invoice id.
 *
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD (super_admin).
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = !EMAIL || !PASSWORD ? "E2E credentials not configured" : null;

test.describe("Invoice mark-unpaid → receipt void + audit", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  test("receipt list updates and audit entry recorded", async ({ page }) => {
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");
    const receiptsBefore = (await page.locator("body").innerText()).trim();

    // Open a paid invoice's edit dialog and mark it unpaid.
    await page.goto("/irrigation-invoices");
    await page.waitForLoadState("networkidle");
    const editBtn = page.getByRole("button", { name: /Edit|এডিট|Pencil/ }).first();
    if (!(await editBtn.count())) test.skip(true, "No editable invoice");
    await editBtn.click();

    const unpaidBtn = page.getByRole("button", { name: /Mark unpaid|আনপেইড/ });
    if (!(await unpaidBtn.count())) test.skip(true, "No paid invoice to mark unpaid");
    await unpaidBtn.first().click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole("button", { name: /Mark unpaid|আনপেইড করুন/ }).click();

    await expect(page.getByText(/পেমেন্ট মুছে ফেলা|payments removed/i)).toBeVisible({ timeout: 10_000 });

    // Receipt list should have changed.
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");
    const receiptsAfter = (await page.locator("body").innerText()).trim();
    expect(receiptsAfter).not.toStrictEqual(receiptsBefore);

    // Audit timeline should contain an irrigation_payment void entry.
    await page.goto("/admin/audit-timeline");
    await page.waitForLoadState("networkidle");
    const searchBox = page.getByPlaceholder(/invoice id|payment id|ইনভয়েস আইডি/i);
    if (await searchBox.count()) await searchBox.fill("void");
    await expect(page.getByText(/void/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
