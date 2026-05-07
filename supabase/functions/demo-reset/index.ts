import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Wipe everything EXCEPT: profiles, user_roles, role_permissions, user_permissions, demo_operations_log, developer_update_logs
const FULL_WIPE_ORDER = [
  "payment_allocations", "payments",
  "loan_payments", "loan_installments", "loans", "loan_plans",
  "irrigation_charges", "irrigation_rates",
  "savings_transactions", "savings_yearly_opening", "farmer_savings_plans", "savings_plans", "shares",
  "expenses",
  "journal_entry_lines", "journal_entries", "ledger_entries", "accounting_periods",
  "receipts", "receipt_settings",
  "sms_logs", "sms_office_settings", "sms_provider_secrets", "sms_settings",
  "qr_tokens", "qr_rotation_settings",
  "audit_logs", "voter_audit_logs", "import_audit_logs",
  "farmer_login_attempts", "farmer_rejections", "notifications",
  "farmer_portal_sessions", "farmer_otps",
  "land_relations", "lands",
  "farmers",
  "seasons",
  "accounts",
  "card_settings", "company_settings",
  "mouzas", "upazilas", "districts", "divisions",
  "offices",
];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
const VILLAGES = ["Baliadanga", "Dhanyakuria", "Ramnagar", "Shantipur", "Madhupur"];
const FATHERS = ["Abdul Karim", "Mohammad Ali", "Rahim Uddin", "Hasan Sheikh", "Jasim Mia"];
const MOTHERS = ["Rahima Begum", "Ayesha Khatun", "Salma Begum", "Roksana Akter", "Hosneara"];

async function seedFarmers(admin: any, officeId: string, count: number) {
  const farmers = Array.from({ length: count }, (_, i) => ({
    farmer_code: `F-${String(i + 1).padStart(5, "0")}`,
    member_no: String(i + 1).padStart(7, "0"),
    name_en: `Demo Farmer ${i + 1}`,
    name_bn: `ডেমো কৃষক ${i + 1}`,
    father_name: pick(FATHERS, i),
    mother_name: pick(MOTHERS, i),
    mobile: `017${String(10000000 + i).padStart(8, "0")}`,
    nid: `19900${String(1000000000 + i).padStart(10, "0")}`,
    village: pick(VILLAGES, i),
    office_id: officeId,
    status: "active",
    is_voter: i % 3 === 0,
  }));
  const { data, error } = await admin.from("farmers").insert(farmers).select("id, is_voter");
  if (error) throw new Error(`farmers: ${error.message}`);
  return data ?? [];
}

async function seedLands(admin: any, officeId: string, farmers: any[], mouzaId: string | null) {
  const lands = farmers.map((f, i) => ({
    farmer_id: f.id,
    land_size: 0.25 + (i % 8) * 0.25,
    mouza: "Baliadanga",
    mouza_id: mouzaId,
    dag_no: `D${100 + i}`,
    field_type: i % 3 === 0 ? "high_land" : i % 3 === 1 ? "medium_land" : "low_land",
    owner_type: "owner",
    office_id: officeId,
    owner_farmer_id: f.id,
  }));
  const { error } = await admin.from("lands").insert(lands);
  if (error) throw new Error(`lands: ${error.message}`);
}

async function seedIrrigation(admin: any, officeId: string, farmers: any[]) {
  const year = new Date().getFullYear();
  const { data: season } = await admin.from("seasons")
    .upsert({ year, type: "boro", name: `Boro ${year}` }, { onConflict: "year,type" }).select("id").single();
  if (!season) return;
  await admin.from("irrigation_rates").insert({
    season_id: season.id, office_id: officeId, basis: "per_size",
    base_rate: 1500, canal_charge: 100, maintenance_charge: 50, other_charge: 0,
  });
  const { data: lands } = await admin.from("lands").select("id, farmer_id, land_size, office_id").limit(farmers.length);
  if (!lands?.length) return;
  const charges = lands.map((l: any, i: number) => {
    const size = Number(l.land_size) || 1;
    const base = 1500 * size;
    const total = base + 100 * size + 50 * size;
    const paid = i % 3 === 0 ? total : i % 3 === 1 ? total / 2 : 0;
    return {
      season_id: season.id, land_id: l.id, farmer_id: l.farmer_id,
      basis: "per_size", quantity: size,
      base_charge: base, canal_charge: 100 * size, maintenance_charge: 50 * size,
      total, paid_amount: paid, due_amount: total - paid, office_id: officeId,
    };
  });
  await admin.from("irrigation_charges").insert(charges);
}

async function seedLoans(admin: any, officeId: string, farmers: any[]) {
  const voters = farmers.filter((f: any) => f.is_voter);
  const { data: plan } = await admin.from("loan_plans").insert({
    name: "Standard 12mo", name_bn: "১২ মাসের সাধারণ", office_id: officeId,
    duration_months: 12, interest_rate: 12, installment_type: "monthly",
    penalty_type: "percentage", penalty_value: 2, grace_period_days: 7, is_active: true,
  }).select("id").single();
  const planId = plan?.id ?? null;
  const loanRows = voters.slice(0, Math.ceil(voters.length * 0.4)).map((f, i) => {
    const principal = 10000 + (i % 5) * 5000;
    const totalPay = principal * 1.12;
    return {
      farmer_id: f.id, principal, interest_rate: 12, total_payable: totalPay, total_due: totalPay,
      installment_amount: totalPay / 12, plan_id: planId,
      status: i % 4 === 0 ? "pending" : "approved", office_id: officeId,
    };
  });
  if (loanRows.length) {
    const { data: ins } = await admin.from("loans").insert(loanRows).select("id, total_payable, status");
    const pays = (ins ?? []).filter((l: any) => l.status === "approved").slice(0, 3).map((l: any) => ({
      loan_id: l.id, amount: Math.round(Number(l.total_payable) * 0.1), office_id: officeId,
    }));
    if (pays.length) await admin.from("loan_payments").insert(pays);
  }
}

async function seedSavings(admin: any, officeId: string, farmers: any[]) {
  const voters = farmers.filter((f: any) => f.is_voter);
  await admin.from("savings_plans").insert({
    name: "DPS 24", name_bn: "ডিপিএস ২৪", office_id: officeId,
    duration_months: 24, installment_type: "monthly", installment_amount: 500,
    interest_rate: 6, maturity_type: "simple", is_active: true,
  });
  const txns = voters.slice(0, Math.ceil(voters.length * 0.6)).flatMap((f, i) => [
    { farmer_id: f.id, type: "deposit", amount: 1000 + (i % 5) * 200, status: "approved", office_id: officeId },
    ...(i % 4 === 0 ? [{ farmer_id: f.id, type: "withdraw", amount: 300, status: "approved", office_id: officeId }] : []),
    // Share collection transactions so the Share Details tab has rows
    ...(i % 3 === 0 ? [{ farmer_id: f.id, type: "share_collection", amount: 500, status: "approved", office_id: officeId, note: "Demo share collection" }] : []),
  ]);
  if (txns.length) {
    const { error } = await admin.from("savings_transactions").insert(txns);
    if (error) throw new Error(`savings_transactions: ${error.message}`);
  }
  const shareRows = voters.slice(0, Math.ceil(voters.length * 0.5)).map((f) => ({
    farmer_id: f.id, balance: 500, office_id: officeId,
  }));
  if (shareRows.length) await admin.from("shares").insert(shareRows);
}

async function seedPayments(admin: any, officeId: string, farmers: any[]) {
  if (!farmers.length) return;
  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const earlierMonth = new Date(Date.now() - 10 * 86400000).toISOString();
  const voters = farmers.filter((f: any) => f.is_voter);
  const rows = voters.flatMap((f, i) => {
    const out: any[] = [];
    // today's collections
    if (i % 3 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 500 + (i % 5) * 100, status: "approved", office_id: officeId, created_at: today });
    if (i % 5 === 0) out.push({ farmer_id: f.id, kind: "loan", amount: 1000, status: "approved", office_id: officeId, created_at: today });
    // earlier in month
    if (i % 2 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 800, status: "approved", office_id: officeId, created_at: earlierMonth });
    if (i % 4 === 0) out.push({ farmer_id: f.id, kind: "savings", amount: 500, status: "approved", office_id: officeId, created_at: yesterday });
    return out;
  });
  if (rows.length) {
    const { error } = await admin.from("payments").insert(rows);
    if (error) throw new Error(`payments: ${error.message}`);
  }
}

async function seedExpenses(admin: any, officeId: string) {
  await admin.from("expenses").insert([
    { head: "Office Rent", amount: 5000, office_id: officeId, payee: "Landlord", note: "Demo" },
    { head: "Electricity", amount: 1200, office_id: officeId, payee: "PDB", note: "Demo" },
    { head: "Stationery", amount: 800, office_id: officeId, payee: "Local Shop", note: "Demo" },
  ]);
}

async function seedAccounts(admin: any) {
  // Codes MUST match what ledger triggers (_acct) look up.
  // Triggers reference: 1010 (cash), 1040 (loans receivable), 2010 (savings payable),
  // 3020 (share capital), 4010 (irrigation income),
  // 5010/5020/5030/5040/5090 (expense heads).
  const accts = [
    { code: "1010", name: "Cash", type: "asset", is_system: true },
    { code: "1020", name: "Bank", type: "asset", is_system: true },
    { code: "1040", name: "Loans Receivable", type: "asset", is_system: true },
    { code: "2010", name: "Savings Payable", type: "liability", is_system: true },
    { code: "3020", name: "Share Capital", type: "equity", is_system: true },
    { code: "4010", name: "Irrigation Income", type: "income", is_system: true },
    { code: "4020", name: "Loan Interest Income", type: "income", is_system: false },
    { code: "5010", name: "Maintenance", type: "expense", is_system: true },
    { code: "5020", name: "Electricity", type: "expense", is_system: true },
    { code: "5030", name: "Salary", type: "expense", is_system: true },
    { code: "5040", name: "Repair", type: "expense", is_system: true },
    { code: "5090", name: "Other Expenses", type: "expense", is_system: true },
  ];
  const { error } = await admin.from("accounts").upsert(accts, { onConflict: "code" });
  if (error) throw error;
}

async function seedSettings(admin: any) {
  await admin.from("company_settings").upsert({
    id: 1, company_name: "Smart Irrigation Cooperative", company_name_bn: "স্মার্ট সেচ সমবায়",
    address: "Baliadanga, Rangpur", mobile: "01700000000", email: "demo@example.com",
  });
  await admin.from("card_settings").upsert({ id: 1 });
}

async function seedLocations(admin: any) {
  const { data: div } = await admin.from("divisions")
    .upsert({ name: "Rangpur", name_bn: "রংপুর", code: "RAN" }, { onConflict: "name" })
    .select("id").single();
  if (!div) return null;
  const { data: dist } = await admin.from("districts")
    .upsert({ name: "Rangpur", name_bn: "রংপুর", code: "RAN-D", division_id: div.id }, { onConflict: "name" })
    .select("id").single();
  if (!dist) return null;
  const { data: upa } = await admin.from("upazilas")
    .upsert({ name: "Pirgachha", name_bn: "পীরগাছা", district_id: dist.id }, { onConflict: "name" })
    .select("id").maybeSingle();
  if (!upa) return null;
  const { data: mouza } = await admin.from("mouzas")
    .upsert({ name: "Baliadanga", name_bn: "বালিয়াডাঙ্গা", upazila_id: upa.id }, { onConflict: "name" })
    .select("id").single();
  return mouza?.id ?? null;
}

async function ensureOffice(admin: any) {
  const officeId = "11111111-1111-1111-1111-111111111111";
  const { data } = await admin.from("offices").select("id").eq("id", officeId).maybeSingle();
  if (!data) await admin.from("offices").insert({ id: officeId, name: "Baliadanga Branch", address: "Rangpur" });
  return officeId;
}

function estimateImport(modules: string[], size: number) {
  const c: Record<string, number> = {};
  if (modules.includes("locations")) c["divisions/districts/upazilas/mouzas"] = 4;
  if (modules.includes("settings")) c["company_settings + card_settings"] = 2;
  if (modules.includes("accounting")) c["accounts"] = 8;
  if (modules.includes("farmers")) { c["farmers"] = size; c["lands"] = size; }
  if (modules.includes("irrigation")) { c["seasons"] = 1; c["irrigation_rates"] = 1; c["irrigation_charges"] = size; }
  if (modules.includes("loans")) { const n = Math.ceil(size * 0.4); c["loan_plans"] = 1; c["loans"] = n; c["loan_payments"] = Math.min(3, n); }
  if (modules.includes("savings")) { const n = Math.ceil(size * 0.6); c["savings_plans"] = 1; c["savings_transactions"] = n + Math.ceil(n / 4); c["shares"] = Math.ceil(size * 0.5); }
  if (modules.includes("expenses")) c["expenses"] = 3;
  return c;
}

async function previewWipe(admin: any) {
  const counts: Record<string, number> = {};
  for (const t of FULL_WIPE_ORDER) {
    const { count } = await admin.from(t).select("*", { count: "exact", head: true });
    if (count) counts[t] = count;
  }
  return counts;
}

// ---- Streaming runner ----
async function runStream(admin: any, action: string, modules: string[], size: number,
  ctx: { userId: string | null; userEmail: string | null; ip: string | null; ua: string | null }) {

  const encoder = new TextEncoder();
  const summary: any = { action, modules };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: any) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        // Build step list
        const steps: { key: string; label: string; fn: () => Promise<void> }[] = [];

        if (action === "reset" || action === "both") {
          for (const t of FULL_WIPE_ORDER) {
            steps.push({
              key: `wipe:${t}`, label: `মুছছে: ${t}`,
              fn: async () => {
                const { error } = await admin.from(t).delete().not("id", "is", null);
                if (error && !/does not exist/i.test(error.message)) {
                  send({ type: "warn", step: `wipe:${t}`, message: error.message });
                }
              },
            });
          }
        }

        let officeId = "11111111-1111-1111-1111-111111111111";
        let mouzaId: string | null = null;
        let farmers: any[] = [];

        if (action === "import" || action === "both") {
          steps.push({ key: "office", label: "অফিস তৈরি/যাচাই", fn: async () => { officeId = await ensureOffice(admin); } });
          steps.push({ key: "locations", label: "লোকেশন seed", fn: async () => { mouzaId = await seedLocations(admin); } });
          if (modules.includes("settings")) steps.push({ key: "settings", label: "সেটিংস seed", fn: async () => { await seedSettings(admin); } });
          // Always seed chart-of-accounts before any module that posts ledger entries,
          // otherwise triggers fail with "null value in column account_id ... violates not-null".
          const needsAccounts = modules.includes("accounting") || modules.includes("loans") ||
            modules.includes("savings") || modules.includes("irrigation") ||
            modules.includes("expenses") || modules.includes("farmers");
          if (needsAccounts) steps.push({ key: "accounting", label: "চার্ট অফ একাউন্টস seed", fn: async () => { await seedAccounts(admin); } });
          if (modules.includes("farmers")) {
            steps.push({ key: "farmers", label: `${size} জন ফার্মার তৈরি`, fn: async () => {
              farmers = await seedFarmers(admin, officeId, size); summary.farmers = farmers.length;
            }});
            steps.push({ key: "lands", label: `${size}টি জমি তৈরি`, fn: async () => { await seedLands(admin, officeId, farmers, mouzaId); }});
          }
          const needFarmers = modules.includes("irrigation") || modules.includes("loans") || modules.includes("savings");
          if (needFarmers && !modules.includes("farmers")) {
            steps.push({ key: "farmers:fetch", label: "বিদ্যমান ফার্মার লোড", fn: async () => {
              const { data } = await admin.from("farmers").select("id, is_voter").limit(size);
              farmers = data ?? [];
            }});
          }
          if (modules.includes("irrigation")) steps.push({ key: "irrigation", label: "সেচ চার্জ seed", fn: async () => { if (farmers.length) await seedIrrigation(admin, officeId, farmers); }});
          if (modules.includes("loans")) steps.push({ key: "loans", label: "ঋণ seed", fn: async () => { if (farmers.length) await seedLoans(admin, officeId, farmers); }});
          if (modules.includes("savings")) steps.push({ key: "savings", label: "সঞ্চয় seed", fn: async () => { if (farmers.length) await seedSavings(admin, officeId, farmers); }});
          if (modules.includes("expenses")) steps.push({ key: "expenses", label: "খরচ seed", fn: async () => { await seedExpenses(admin, officeId); }});
          // Always seed payments so today's & this-month collection cards show data
          if (modules.includes("farmers") || needFarmers) {
            steps.push({ key: "payments", label: "পেমেন্ট/কালেকশন seed", fn: async () => { if (farmers.length) await seedPayments(admin, officeId, farmers); }});
          }
        }

        const total = steps.length;
        send({ type: "start", total });

        for (let i = 0; i < steps.length; i++) {
          const s = steps[i];
          send({ type: "step", index: i + 1, total, key: s.key, label: s.label, percent: Math.round(((i) / total) * 100) });
          try {
            await s.fn();
            send({ type: "done", index: i + 1, total, key: s.key, percent: Math.round(((i + 1) / total) * 100) });
          } catch (e: any) {
            send({ type: "error", step: s.key, message: e?.message ?? String(e) });
            throw e;
          }
        }

        await admin.from("demo_operations_log").insert({
          user_id: ctx.userId, user_email: ctx.userEmail, action, modules, size,
          ip: ctx.ip, user_agent: ctx.ua, success: true, summary,
        });

        send({ type: "complete", percent: 100, summary });
      } catch (e: any) {
        try {
          await admin.from("demo_operations_log").insert({
            user_id: ctx.userId, user_email: ctx.userEmail, action, modules, size,
            ip: ctx.ip, user_agent: ctx.ua, success: false, error_message: e?.message ?? String(e),
          });
        } catch (_) {/* */}
        controller.enqueue(encoder.encode(JSON.stringify({ type: "fatal", message: e?.message ?? String(e) }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", who.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "super_admin" || r.role === "developer")) return json({ error: "Forbidden — developer or super admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: "preview" | "reset" | "import" | "both" = body?.action ?? "both";
    const modules: string[] = Array.isArray(body?.modules) ? body.modules : [];
    const size: number = Math.max(5, Math.min(500, Number(body?.size) || 50));

    if (action === "preview") {
      const wipePreview = await previewWipe(admin);
      const importPreview = estimateImport(modules, size);
      return json({ ok: true, action: "preview", wipe_preview: wipePreview, import_preview: importPreview });
    }

    if (body?.confirm !== "RESET") return json({ error: "Confirmation required (confirm: 'RESET')" }, 400);

    const ctx = { userId: who.user.id, userEmail: who.user.email ?? null, ip, ua };

    if (body?.stream) return runStream(admin, action, modules, size, ctx);

    // Non-streaming fallback (collect events from stream)
    const resp = await runStream(admin, action, modules, size, ctx);
    const text = await resp.text();
    return json({ ok: true, log: text.split("\n").filter(Boolean).map((l) => JSON.parse(l)) });
  } catch (e: any) {
    console.error("demo-reset error:", e);
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
