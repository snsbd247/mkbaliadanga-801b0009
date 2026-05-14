#!/usr/bin/env node
/**
 * Laravel API smoke test.
 * Usage:
 *   API_URL=https://api.example.com/api API_EMAIL=admin@x ADMIN_PASSWORD=… \
 *     node scripts/api-smoke.mjs
 *
 * Exits 0 on full success, 1 on any failure. Designed to run in CI before
 * the frontend cutover.
 */

const API = process.env.API_URL?.replace(/\/$/, "");
const EMAIL = process.env.API_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;

if (!API || !EMAIL || !PASS) {
  console.error("Set API_URL, API_EMAIL, ADMIN_PASSWORD");
  process.exit(2);
}

let token = null;
const results = [];

async function call(method, path, body) {
  const url = `${API}${path}`;
  const t0 = Date.now();
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const ms = Date.now() - t0;
    const ok = res.status < 400;
    results.push({ method, path, status: res.status, ms, ok });
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok, status: res.status, data };
  } catch (e) {
    results.push({ method, path, status: 0, ms: Date.now() - t0, ok: false, err: e.message });
    return { ok: false, status: 0, data: null };
  }
}

const READ_ENDPOINTS = [
  "/auth/me",
  "/farmers?per_page=1",
  "/lands?per_page=1",
  "/seasons",
  "/loans?per_page=1",
  "/loan-plans",
  "/savings/accounts?per_page=1",
  "/payments?per_page=1",
  "/irrigation-rates",
  "/accounts",
  "/journals?per_page=1",
  "/reports/trial-balance",
  "/assets?per_page=1",
  "/users?per_page=1",
  "/roles",
  "/offices",
  "/sms/logs?per_page=1",
  "/audit?per_page=1",
];

(async () => {
  console.log(`→ POST /auth/login as ${EMAIL}`);
  const login = await call("POST", "/auth/login", { email: EMAIL, password: PASS });
  if (!login.ok || !(login.data?.token || login.data?.access_token)) {
    console.error("Login failed", login);
    process.exit(1);
  }
  token = login.data.token || login.data.access_token;

  for (const p of READ_ENDPOINTS) {
    process.stdout.write(`→ GET ${p} … `);
    const r = await call("GET", p);
    console.log(r.ok ? `${r.status} OK` : `${r.status} FAIL`);
  }

  // Write smoke: create + delete a tiny journal entry (zero-amount, balanced).
  if (process.env.SMOKE_WRITE === "1") {
    process.stdout.write(`→ POST /journals (write smoke) … `);
    const created = await call("POST", "/journals", {
      entry_date: new Date().toISOString().slice(0, 10),
      memo: "smoke-test",
      lines: [
        { account_code: "1000", debit: 0, credit: 0 },
        { account_code: "2000", debit: 0, credit: 0 },
      ],
    });
    console.log(created.ok ? `${created.status} OK` : `${created.status} (write skipped)`);
    if (created.ok && created.data?.id) {
      await call("DELETE", `/journals/${created.data.id}`);
    }
  }

  await call("POST", "/auth/logout");

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error("Failures:");
    failed.forEach(f => console.error(`  ${f.method} ${f.path} → ${f.status}${f.err ? " " + f.err : ""}`));
    process.exit(1);
  }
  console.log("All endpoints healthy ✔");
})();
