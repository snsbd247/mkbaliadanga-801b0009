import { test, expect } from "@playwright/test";

/**
 * Legacy Irrigation "Old Data" search (/members/old-data).
 *
 * Verifies that the `q` search works for both a mobile number and a farmer ID,
 * that each result row is labelled with the field it matched on, and that the
 * result set only contains rows returned by the stubbed backend (no stale /
 * paginated bleed-through from a previous search).
 *
 * The list endpoint is intercepted so the test never depends on live data.
 *
 * Requires E2E_EMAIL / E2E_PASSWORD.
 */
test.describe("Legacy Irrigation search (q)", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Set E2E_EMAIL/E2E_PASSWORD to run",
  );

  const MOBILE = "01700000000";
  const FID = "2473";

  const mobileRows = [
    {
      id: "row-mobile-1",
      import_batch_id: "b1",
      created_at: new Date().toISOString(),
      legacy_farmer_code: "L-001",
      farmer_name: "করিম মিয়া",
      mobile_no: MOBILE,
      owner_mobile_no: null,
      owner_fid: "9999",
      season_year: "2024",
      mouza_name: "বালিয়াডাঙ্গা",
      dag_no: "12",
      land_shatak: 5,
      rate: 100,
      owner_type_name: "মালিক",
      receipt_no: "R-1001",
      paid_amount: 500,
      collection_date: "2024-01-10",
    },
  ];

  const fidRows = [
    {
      id: "row-fid-1",
      import_batch_id: "b2",
      created_at: new Date().toISOString(),
      legacy_farmer_code: "L-777",
      farmer_name: "রহিম উদ্দিন",
      mobile_no: "01800000000",
      owner_mobile_no: null,
      owner_fid: FID,
      season_year: "2023",
      mouza_name: "চরপাড়া",
      dag_no: "44",
      land_shatak: 8,
      rate: 120,
      owner_type_name: "বর্গা",
      receipt_no: "R-2002",
      paid_amount: 960,
      collection_date: "2023-05-02",
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Return rows based on the `q` sent by the frontend so we can prove the
    // correct query reaches the backend and results never mix.
    await page.route("**/api/legacy-irrigation**", (route) => {
      const url = new URL(route.request().url());
      const q = url.searchParams.get("q") ?? "";
      let body: unknown[] = [];
      if (q === MOBILE) body = mobileRows;
      else if (q === FID) body = fidRows;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin|farmers|members)/);
    await page.goto("/members/old-data");
  });

  async function search(page: import("@playwright/test").Page, value: string) {
    const input = page.getByRole("textbox").first();
    await input.fill(value);
    await page.getByRole("button", { name: /Search|খুঁজুন/ }).click();
  }

  test("rejects invalid input with a clear error", async ({ page }) => {
    await search(page, "ab");
    await expect(page.getByText(/Only digits are allowed|শুধু সংখ্যা/)).toBeVisible();
    await search(page, "1");
    await expect(page.getByText(/at least 3 digits|কমপক্ষে ৩/)).toBeVisible();
  });

  test("mobile search returns only mobile-matched rows labelled 'Mobile'", async ({ page }) => {
    await search(page, MOBILE);
    await expect(page.getByText("করিম মিয়া")).toBeVisible();
    await expect(page.getByText("রহিম উদ্দিন")).toHaveCount(0);
    await expect(page.getByText(/^(Mobile|মোবাইল)$/)).toBeVisible();
    // Exactly one data row (plus the totals row).
    expect(await page.getByText("R-1001").count()).toBe(1);
  });

  test("farmer ID search returns only ID-matched rows labelled 'Farmer ID'", async ({ page }) => {
    await search(page, FID);
    await expect(page.getByText("রহিম উদ্দিন")).toBeVisible();
    await expect(page.getByText("করিম মিয়া")).toHaveCount(0);
    await expect(page.getByText(/^(Farmer ID|ফার্মার আইডি)$/)).toBeVisible();
    expect(await page.getByText("R-2002").count()).toBe(1);
  });

  test("switching searches does not leak previous results", async ({ page }) => {
    await search(page, MOBILE);
    await expect(page.getByText("করিম মিয়া")).toBeVisible();
    await search(page, FID);
    await expect(page.getByText("রহিম উদ্দিন")).toBeVisible();
    await expect(page.getByText("করিম মিয়া")).toHaveCount(0);
  });
});
