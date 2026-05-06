import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ---- Tables grouped by module (deletion order matters: children → parents) ----
const WIPE_GROUPS: Record<string, string[]> = {
  // transactional
  payments: ["payment_allocations", "payments"],
  loans: ["loan_payments", "loan_installments", "loans", "loan_plans"],
  irrigation: ["irrigation_charges", "irrigation_rates"],
  savings: ["savings_transactions", "savings_yearly_opening", "farmer_savings_plans", "savings_plans", "shares"],
  expenses: ["expenses"],
  accounting: ["journal_entry_lines", "journal_entries", "ledger_entries", "accounting_periods", "accounts"],
  receipts: ["receipts"],
  sms: ["sms_logs", "sms_office_settings", "sms_provider_secrets", "sms_settings"],
  audit: ["audit_logs", "voter_audit_logs", "import_audit_logs", "farmer_login_attempts", "farmer_rejections", "notifications"],
  qr: ["qr_tokens", "qr_rotation_settings"],
  farmer_portal: ["farmer_portal_sessions", "farmer_otps"],
  lands: ["land_relations", "lands"],
  farmers: ["farmers"],
  seasons: ["seasons"],
  settings: ["company_settings", "card_settings", "receipt_settings"],
  locations: ["mouzas", "upazilas", "districts", "divisions"],
  offices: ["offices"],
};

// Full wipe order — must reference children before parents
const FULL_WIPE_ORDER = [
  "payment_allocations", "payments",
  "loan_payments", "loan_installments", "loans", "loan_plans",
  "irrigation_charges", "irrigation_rates",
  "savings_transactions", "savings_yearly_opening", "farmer_savings_plans", "savings_plans", "shares",
  "expenses",
  "journal_entry_lines", "journal_entries", "ledger_entries", "accounting_periods",
  "receipts",
  "sms_logs", "sms_office_settings",
  "audit_logs", "voter_audit_logs", "import_audit_logs",
  "farmer_login_attempts", "farmer_rejections", "notifications",
  "qr_tokens",
  "farmer_portal_sessions", "farmer_otps",
  "land_relations", "lands",
  "farmers",
  "seasons",
  "accounts",
];

async function wipeAll(admin: any) {
  const results: Record<string, string> = {};
  for (const t of FULL_WIPE_ORDER) {
    const { error } = await admin.from(t).delete().not("id", "is", null);
    results[t] = error ? `ERR: ${error.message}` : "ok";
  }
  return results;
}

// ---- Demo seed builders ----
function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

const VILLAGES = ["Baliadanga", "Dhanyakuria", "Ramnagar", "Shantipur", "Madhupur"];
const FATHERS = ["Abdul Karim", "Mohammad Ali", "Rahim Uddin", "Hasan Sheikh", "Jasim Mia"];
const MOTHERS = ["Rahima Begum", "Ayesha Khatun", "Salma Begum", "Roksana Akter", "Hosneara"];

async function seedFarmers(admin: any, officeId: string, count: number, mouzaId: string | null) {
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
    mouza: "Baliadanga",
    office_id: officeId,
    status: "active",
    is_voter: i % 3 === 0,
  }));
  const { data, error } = await admin.from("farmers").insert(farmers).select("id");
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
  // Need season + rate
  const year = new Date().getFullYear();
  const { data: season } = await admin.from("seasons")
    .upsert({ year, type: "boro", name: `Boro ${year}` }, { onConflict: "year,type" }).select("id").single();
  if (!season) return;
  await admin.from("irrigation_rates").insert({
    season_id: season.id, office_id: officeId, basis: "per_size",
    base_rate: 1500, canal_charge: 100, maintenance_charge: 50, other_charge: 0,
  });
  // Get lands for charges
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
      total, paid_amount: paid, due_amount: total - paid,
      office_id: officeId,
    };
  });
  await admin.from("irrigation_charges").insert(charges);
}

async function seedLoans(admin: any, officeId: string, farmers: any[]) {
  const { data: plan } = await admin.from("loan_plans").insert({
    name: "Standard 12mo", name_bn: "১২ মাসের সাধারণ", office_id: officeId,
    duration_months: 12, interest_rate: 12, installment_type: "monthly",
    penalty_type: "percentage", penalty_value: 2, grace_period_days: 7, is_active: true,
  }).select("id").single();
  const planId = plan?.id ?? null;
  const loanRows = farmers.slice(0, Math.ceil(farmers.length * 0.4)).map((f, i) => {
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
    // Sample payments on approved loans
    const pays = (ins ?? []).filter((l: any) => l.status === "approved").slice(0, 3).map((l: any) => ({
      loan_id: l.id, amount: Math.round(Number(l.total_payable) * 0.1), office_id: officeId,
    }));
    if (pays.length) await admin.from("loan_payments").insert(pays);
  }
}

async function seedSavings(admin: any, officeId: string, farmers: any[]) {
  await admin.from("savings_plans").insert({
    name: "DPS 24", name_bn: "ডিপিএস ২৪", office_id: officeId,
    duration_months: 24, installment_type: "monthly", installment_amount: 500,
    interest_rate: 6, maturity_type: "simple", is_active: true,
  });
  const txns = farmers.slice(0, Math.ceil(farmers.length * 0.6)).flatMap((f, i) => [
    { farmer_id: f.id, type: "deposit", amount: 1000 + (i % 5) * 200, status: "approved", office_id: officeId },
    ...(i % 4 === 0 ? [{ farmer_id: f.id, type: "withdrawal", amount: 300, status: "approved", office_id: officeId }] : []),
  ]);
  if (txns.length) await admin.from("savings_transactions").insert(txns);

  const shareRows = farmers.slice(0, Math.ceil(farmers.length * 0.5)).map((f) => ({
    farmer_id: f.id, balance: 500, office_id: officeId,
  }));
  if (shareRows.length) await admin.from("shares").insert(shareRows);
}

async function seedExpenses(admin: any, officeId: string) {
  await admin.from("expenses").insert([
    { head: "Office Rent", amount: 5000, office_id: officeId, payee: "Landlord", note: "Demo" },
    { head: "Electricity", amount: 1200, office_id: officeId, payee: "PDB", note: "Demo" },
    { head: "Stationery", amount: 800, office_id: officeId, payee: "Local Shop", note: "Demo" },
  ]);
}

async function seedAccounts(admin: any) {
  const accts = [
    { code: "1000", name: "Cash", type: "asset", is_system: true },
    { code: "1100", name: "Bank", type: "asset", is_system: true },
    { code: "1200", name: "Loans Receivable", type: "asset" },
    { code: "2000", name: "Savings Payable", type: "liability" },
    { code: "3000", name: "Share Capital", type: "equity" },
    { code: "4000", name: "Irrigation Income", type: "income" },
    { code: "4100", name: "Loan Interest Income", type: "income" },
    { code: "5000", name: "Operating Expenses", type: "expense" },
  ];
  await admin.from("accounts").upsert(accts, { onConflict: "code" });
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
  if (!data) {
    await admin.from("offices").insert({ id: officeId, name: "Baliadanga Branch", address: "Rangpur" });
  }
  return officeId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
    if (!(roles ?? []).some((r: any) => r.role === "super_admin")) return json({ error: "Forbidden — super admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action: "reset" | "import" | "both" = body?.action ?? "both";
    const modules: string[] = Array.isArray(body?.modules) ? body.modules : [];
    const size: number = Math.max(5, Math.min(500, Number(body?.size) || 50));
    const confirm = body?.confirm;
    if (confirm !== "RESET") return json({ error: "Confirmation required (confirm: 'RESET')" }, 400);

    const result: any = { action, modules };

    if (action === "reset" || action === "both") {
      result.wiped = await wipeAll(admin);
    }

    if (action === "import" || action === "both") {
      const officeId = await ensureOffice(admin);
      let mouzaId: string | null = null;
      if (modules.includes("locations")) mouzaId = await seedLocations(admin);
      else mouzaId = await seedLocations(admin); // always need basic location for farmers
      if (modules.includes("settings")) await seedSettings(admin);
      if (modules.includes("accounting")) await seedAccounts(admin);

      let farmers: any[] = [];
      if (modules.includes("farmers")) {
        farmers = await seedFarmers(admin, officeId, size, mouzaId);
        await seedLands(admin, officeId, farmers, mouzaId);
        result.farmers = farmers.length;
      }
      // For other modules, need farmers — fetch existing if not just inserted
      if (!farmers.length && (modules.includes("irrigation") || modules.includes("loans") || modules.includes("savings"))) {
        const { data } = await admin.from("farmers").select("id").limit(size);
        farmers = data ?? [];
      }
      if (modules.includes("irrigation") && farmers.length) await seedIrrigation(admin, officeId, farmers);
      if (modules.includes("loans") && farmers.length) await seedLoans(admin, officeId, farmers);
      if (modules.includes("savings") && farmers.length) await seedSavings(admin, officeId, farmers);
      if (modules.includes("expenses")) await seedExpenses(admin, officeId);
    }

    return json({ ok: true, ...result });
  } catch (e: any) {
    console.error("demo-reset error:", e);
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
