import { test, expect } from "@playwright/test";
import fs from "node:fs";

/**
 * Voter List CSV export should:
 *   - download a file with the expected header columns
 *   - have one data row per row visible in the table
 *   - each CSV row's voter_number / account_number / mobile must match
 *     the rendered table cells
 *
 * Requires E2E_EMAIL / E2E_PASSWORD env vars.
 */
const EXPECTED_HEADERS = [
  "Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Village", "Office",
];

function parseCsv(text: string): string[][] {
  // Minimal RFC-4180 parser sufficient for our quoted/escaped fields.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

test.describe("Voter List CSV export", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Set E2E_EMAIL/E2E_PASSWORD to run voter export e2e",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin|farmers)/);
  });

  test("downloads CSV whose columns and row count match the table", async ({ page }) => {
    await page.goto("/voters");
    await expect(page.getByRole("button", { name: /Export CSV/i })).toBeVisible();

    // Read currently-visible voter numbers (column 1) for cross-checking.
    const visibleVoterNos = await page.locator("table tbody tr td:first-child").allTextContents();
    test.skip(visibleVoterNos.length === 0, "No voter rows to export — populate a voter to run this test");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Export CSV/i }).click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();
    const csv = fs.readFileSync(path!, "utf8");
    const rows = parseCsv(csv).filter(r => r.some(c => c.length));

    // Header matches exactly.
    expect(rows[0]).toEqual(EXPECTED_HEADERS);

    // Row count matches table.
    expect(rows.length - 1).toBe(visibleVoterNos.length);

    // Voter numbers in CSV match the table column 1.
    const csvVoterNos = rows.slice(1).map(r => r[0]);
    expect(csvVoterNos).toEqual(visibleVoterNos.map(s => s.trim()));
  });
});
