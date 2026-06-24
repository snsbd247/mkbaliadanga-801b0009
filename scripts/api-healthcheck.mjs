#!/usr/bin/env node
/**
 * API health-check — verifies auth, office-scoping, and receipt-number
 * concurrency on a running Laravel backend.
 *
 * Usage:
 *   API_URL=https://mohammadkhani.com/api \
 *   ADMIN_USER=ismail162 ADMIN_PASSWORD=Admin@123 \
 *     node scripts/api-healthcheck.mjs
 *
 * Optional: SCOPE_USER / SCOPE_PASSWORD — a non-admin user bound to one
 * office, used to confirm office isolation (cannot see other offices' data).
 *
 * Exits 0 if all checks pass, 1 otherwise. Safe to run on a live host:
 * receipt concurrency uses a dry/void path when supported, otherwise it
 * issues real receipts and reports the numbers for manual cleanup.
 */

const API = process.env.API_URL?.replace(/\/$/, "");
const USER = process.env.ADMIN_USER;
const PASS = process.env.ADMIN_PASSWORD;
const SCOPE_USER = process.env.SCOPE_USER;
const SCOPE_PASS = process.env.SCOPE_PASSWORD;

if (!API || !USER || !PASS) {
  console.error("Set API_URL, ADMIN_USER, ADMIN_PASSWORD");
  process.exit(2);
}

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`);
}

async function call(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, ok: res.status < 400, data };
}

async function login(username, password) {
  // Backend accepts username or email on the same field.
  const r = await call("POST", "/auth/login", {
    body: { username, email: username, password },
  });
  return r.ok ? r.data?.token || r.data?.access_token : null;
}

(async () => {
  // 1) AUTH — valid login succeeds
  const token = await login(USER, PASS);
  record("auth: admin login returns token", !!token);
  if (!token) {
    summary();
    return;
  }

  // 2) AUTH — bad password rejected
  const bad = await login(USER, "wrong-" + Date.now());
  record("auth: wrong password rejected", !bad);

  // 3) AUTH — protected route requires token
  const noTok = await call("GET", "/me");
  record("auth: /me without token is 401", noTok.status === 401);

  // 4) AUTH — /me with token works
  const me = await call("GET", "/me", { token });
  record("auth: /me with token returns user", me.ok && !!me.data);
  const adminOffice = me.data?.office_id ?? me.data?.user?.office_id;

  // 5) OFFICE-SCOPING — admin can list farmers
  const farmers = await call("GET", "/farmers?per_page=5", { token });
  record("scope: admin can list farmers", farmers.ok);

  // 6) OFFICE-SCOPING — scoped user only sees own office
  if (SCOPE_USER && SCOPE_PASS) {
    const sToken = await login(SCOPE_USER, SCOPE_PASS);
    if (sToken) {
      const sMe = await call("GET", "/me", { token: sToken });
      const sOffice = sMe.data?.office_id ?? sMe.data?.user?.office_id;
      const sFarmers = await call("GET", "/farmers?per_page=50", { token: sToken });
      const rows = sFarmers.data?.data ?? sFarmers.data ?? [];
      const leak = Array.isArray(rows)
        ? rows.filter((r) => r.office_id && sOffice && r.office_id !== sOffice)
        : [];
      record(
        "scope: scoped user sees only own office",
        sFarmers.ok && leak.length === 0,
        leak.length ? `${leak.length} cross-office rows leaked` : `office ${sOffice}`
      );
      // cross-office direct access should be forbidden
      if (adminOffice && sOffice && adminOffice !== sOffice) {
        const cross = await call("GET", `/offices/${adminOffice}/farmers`, { token: sToken });
        record("scope: cross-office direct access blocked", cross.status === 403 || cross.status === 404);
      }
    } else {
      record("scope: scoped user login", false, "could not log in SCOPE_USER");
    }
  } else {
    record("scope: scoped-user isolation", true, "skipped (set SCOPE_USER/SCOPE_PASSWORD)");
  }

  // 7) RECEIPT NUMBERING CONCURRENCY — fire N parallel issues, expect unique numbers
  const N = Number(process.env.CONCURRENCY || 8);
  const payload = { amount: 1, note: "healthcheck", dry_run: true };
  const reqs = Array.from({ length: N }, () =>
    call("POST", "/receipts/preview-number", { token, body: payload }).catch(() => ({ ok: false }))
  );
  let res = await Promise.all(reqs);
  let nums = res.map((r) => r.data?.receipt_no ?? r.data?.number).filter(Boolean);

  // Fall back to real issuance if preview endpoint is absent
  if (nums.length === 0) {
    const realReqs = Array.from({ length: N }, () =>
      call("POST", "/receipts", { token, body: { amount: 1, note: "healthcheck" } }).catch(() => ({ ok: false }))
    );
    res = await Promise.all(realReqs);
    nums = res.map((r) => r.data?.receipt_no ?? r.data?.number).filter(Boolean);
    if (nums.length) {
      console.log(`  (issued real receipts — review/void: ${nums.join(", ")})`);
    }
  }

  const unique = new Set(nums);
  record(
    "receipt: concurrent numbers are unique",
    nums.length > 0 && unique.size === nums.length,
    `${unique.size}/${nums.length} unique`
  );

  summary();
})();

function summary() {
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}
