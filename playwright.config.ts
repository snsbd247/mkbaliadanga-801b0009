import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config.
 *
 * Required env vars (set locally or in CI):
 *   E2E_BASE_URL          – e.g. https://id-preview--…lovable.app  or  http://localhost:5173
 *   E2E_STAFF_EMAIL       – staff user email (no committee role)
 *   E2E_COMMITTEE_EMAIL   – committee or super_admin user email
 *   E2E_PASSWORD          – shared password for both
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
