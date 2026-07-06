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
  "loan_payments", "loan_installment_delay_audit", "loan_installments", "loan_guarantors", "loans", "loan_plans", "loan_delay_fee_settings",
  "irrigation_sms_logs",
  "irrigation_due_promises",
  "irrigation_invoice_payments", "irrigation_invoice_audit", "irrigation_invoices",
  "irrigation_delay_fee_audit",
  "irrigation_charges", "irrigation_rates", "irrigation_season_rates", "irrigation_charge_settings",
  "savings_transactions", "savings_yearly_opening", "farmer_savings_plans", "savings_plans", "shares",
  "expenses",
  "bank_transactions", "bank_accounts",
  "office_incomes", "hand_cash_submissions",
  "cashbook_submissions",
  "farmer_notes",
  "public_payment_intents",
  "land_transfer_recipients", "land_transfers",
  "land_history",
  "land_change_log",
  // Assets module (delete dependents first; assets last)
  "asset_alerts", "asset_audit_logs", "asset_scan_logs",
  "asset_damage_reports", "asset_disposals",
  "asset_maintenance_schedules", "asset_maintenance_logs",
  "asset_movements", "asset_installations", "asset_purchases",
  "asset_depreciation_schedule", "asset_depreciation_settings",
  "asset_stocks", "assets", "asset_categories",
  "journal_entry_lines", "journal_entries", "ledger_entries", "accounting_periods",
  "receipts", "receipt_counters", "receipt_settings",
  "sms_logs", "sms_office_settings", "sms_provider_secrets", "sms_settings",
  "qr_tokens", "qr_rotation_settings",
  "audit_logs", "voter_audit_logs", "import_audit_logs",
  "irrigation_rate_audit_logs",
  "farmer_login_attempts", "farmer_rejections", "notifications",
  "farmer_portal_sessions", "farmer_otps",
  "land_relations", "lands",
  "patwaris",
  "farmers",
  "seasons", "irrigation_season_types",
  "land_types",
  "accounts",
  "card_settings", "company_settings",
  "mouzas", "upazilas", "districts", "divisions",
  "offices",
];

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }
const VILLAGES = ["Baliadanga", "Dhanyakuria", "Ramnagar", "Shantipur", "Madhupur", "Kismatpur", "Char Bhabanipur", "Uttar Para", "Dakshin Para", "Naya Bazar"];

// Realistic Bangladeshi names (English + Bangla pairs)
const MALE_NAMES: { en: string; bn: string }[] = [
  { en: "Md. Abdur Rahman", bn: "মোঃ আব্দুর রহমান" },
  { en: "Md. Karim Uddin", bn: "মোঃ করিম উদ্দিন" },
  { en: "Mohammad Ali Hossain", bn: "মোহাম্মদ আলী হোসেন" },
  { en: "Md. Jashim Uddin", bn: "মোঃ জসিম উদ্দিন" },
  { en: "Md. Shahidul Islam", bn: "মোঃ শহিদুল ইসলাম" },
  { en: "Md. Nurul Hoque", bn: "মোঃ নুরুল হক" },
  { en: "Abdul Mannan", bn: "আব্দুল মান্নান" },
  { en: "Md. Faruk Hossain", bn: "মোঃ ফারুক হোসেন" },
  { en: "Md. Anwar Hossain", bn: "মোঃ আনোয়ার হোসেন" },
  { en: "Md. Liton Mia", bn: "মোঃ লিটন মিয়া" },
  { en: "Md. Kamal Hossain", bn: "মোঃ কামাল হোসেন" },
  { en: "Md. Rafiqul Islam", bn: "মোঃ রফিকুল ইসলাম" },
  { en: "Md. Saiful Islam", bn: "মোঃ সাইফুল ইসলাম" },
  { en: "Md. Bablu Mia", bn: "মোঃ বাবলু মিয়া" },
  { en: "Md. Sohel Rana", bn: "মোঃ সোহেল রানা" },
  { en: "Md. Habibur Rahman", bn: "মোঃ হাবিবুর রহমান" },
  { en: "Md. Mizanur Rahman", bn: "মোঃ মিজানুর রহমান" },
  { en: "Md. Ashraful Alam", bn: "মোঃ আশরাফুল আলম" },
  { en: "Md. Tofazzal Hossain", bn: "মোঃ তোফাজ্জল হোসেন" },
  { en: "Md. Mokbul Hossain", bn: "মোঃ মকবুল হোসেন" },
  { en: "Md. Jamal Uddin", bn: "মোঃ জামাল উদ্দিন" },
  { en: "Md. Selim Reza", bn: "মোঃ সেলিম রেজা" },
  { en: "Md. Rokon Mia", bn: "মোঃ রকন মিয়া" },
  { en: "Md. Kabir Hossain", bn: "মোঃ কবির হোসেন" },
  { en: "Md. Belal Hossain", bn: "মোঃ বেলাল হোসেন" },
  { en: "Md. Monir Hossain", bn: "মোঃ মনির হোসেন" },
  { en: "Md. Ruhul Amin", bn: "মোঃ রুহুল আমিন" },
  { en: "Md. Aminul Islam", bn: "মোঃ আমিনুল ইসলাম" },
  { en: "Md. Nazrul Islam", bn: "মোঃ নজরুল ইসলাম" },
  { en: "Md. Mosharraf Hossain", bn: "মোঃ মোশাররফ হোসেন" },
];
const FEMALE_NAMES: { en: string; bn: string }[] = [
  { en: "Mst. Rahima Khatun", bn: "মোসাঃ রহিমা খাতুন" },
  { en: "Mst. Ayesha Begum", bn: "মোসাঃ আয়েশা বেগম" },
  { en: "Mst. Salma Akter", bn: "মোসাঃ সালমা আক্তার" },
  { en: "Mst. Roksana Begum", bn: "মোসাঃ রোকসানা বেগম" },
  { en: "Mst. Hosneara Begum", bn: "মোসাঃ হোসনেয়ারা বেগম" },
  { en: "Mst. Shahanaz Parvin", bn: "মোসাঃ শাহানাজ পারভিন" },
  { en: "Mst. Rabeya Khatun", bn: "মোসাঃ রাবেয়া খাতুন" },
  { en: "Mst. Jorina Begum", bn: "মোসাঃ জরিনা বেগম" },
  { en: "Mst. Nasima Akter", bn: "মোসাঃ নাসিমা আক্তার" },
  { en: "Mst. Mariam Begum", bn: "মোসাঃ মরিয়ম বেগম" },
];
const FATHERS = MALE_NAMES;
const MOTHERS = FEMALE_NAMES;

// Real Bangladesh location data (Rajshahi division → Chapainawabganj district)
const LOCATION_TREE = {
  division: { name: "Rajshahi", name_bn: "রাজশাহী", code: "RAJ" },
  districts: [
    { name: "Chapainawabganj", name_bn: "চাঁপাইনবাবগঞ্জ", code: "CHN-D",
      upazilas: [
        { name: "Chapainawabganj Sadar", name_bn: "চাঁপাইনবাবগঞ্জ সদর", mouzas: [
          { name: "Baroghoria", name_bn: "বারঘরিয়া" },
          { name: "Maharajpur", name_bn: "মহারাজপুর" },
          { name: "Jhilim", name_bn: "ঝিলিম" },
          { name: "Ranihati", name_bn: "রানীহাটি" },
          { name: "Shyampur", name_bn: "শ্যামপুর" },
        ]},
        { name: "Shibganj", name_bn: "শিবগঞ্জ", mouzas: [
          { name: "Kansat", name_bn: "কানসাট" },
          { name: "Binodpur", name_bn: "বিনোদপুর" },
          { name: "Monakasha", name_bn: "মনাকষা" },
          { name: "Durlovpur", name_bn: "দুর্লভপুর" },
          { name: "Chak Kirti", name_bn: "চক কীর্তি" },
        ]},
        { name: "Gomastapur", name_bn: "গোমস্তাপুর", mouzas: [
          { name: "Rohanpur", name_bn: "রহনপুর" },
          { name: "Boalia", name_bn: "বোয়ালিয়া" },
          { name: "Radhanagar", name_bn: "রাধানগর" },
          { name: "Parbatipur", name_bn: "পার্বতীপুর" },
        ]},
        { name: "Nachole", name_bn: "নাচোল", mouzas: [
          { name: "Kasba", name_bn: "কসবা" },
          { name: "Nezampur", name_bn: "নেজামপুর" },
          { name: "Fatehpur", name_bn: "ফতেপুর" },
        ]},
        { name: "Bholahat", name_bn: "ভোলাহাট", mouzas: [
          { name: "Bholahat", name_bn: "ভোলাহাট" },
          { name: "Gohalbari", name_bn: "গোহালবাড়ী" },
          { name: "Jambaria", name_bn: "জামবাড়িয়া" },
        ]},
      ]},
  ],
} as const;

type LocPick = { division_id: string; district_id: string; upazila_id: string; mouza_id: string; mouza_name: string };

type VoterCfg = {
  voterRatio: number;            // e.g. 3 -> every 3rd farmer is a voter (1/3)
  voterNumberFormat: string;     // tokens: {seq:N} {office} {year}
  accountNumberFormat: string;   // tokens: {seq:N} {office} {year}
};

function formatToken(fmt: string, ctx: { seq: number; office: string; year: number }): string {
  return fmt
    .replace(/\{seq(?::(\d+))?\}/g, (_, n) => String(ctx.seq).padStart(Number(n || 5), "0"))
    .replace(/\{office\}/g, ctx.office)
    .replace(/\{year\}/g, String(ctx.year));
}

// Farmer ID/account/voter identifiers must be the same unique 5-digit value.
function normalizeFiveDigitIdentifier(rendered: string, fallbackSeq: number): string {
  const digits = String(rendered ?? "").replace(/\D/g, "");
  if (digits.length >= 5) return digits.slice(-5);
  if (digits.length > 0) return digits.padStart(5, "0");
  return String(((fallbackSeq - 1) % 99999) + 1).padStart(5, "0");
}

async function seedFarmers(admin: any, officeId: string, count: number, cfg: VoterCfg, locs: LocPick[], customNames?: { en: string; bn?: string; father?: string; mother?: string; mobile?: string; nid?: string }[]) {
  const ratio = Math.max(2, Math.floor(cfg.voterRatio || 3));
  const year = new Date().getFullYear();
  const officeShort = officeId.slice(0, 4).toUpperCase();
  // De-dup: load existing identifiers/nids/mobiles so inserts are safe with or without a wipe.
  const { data: existing } = await admin.from("farmers")
    .select("office_id, farmer_code, account_number, voter_number, nid, name_en, mobile");
  const existingCodes = new Set<string>();
  for (const row of existing ?? []) {
    for (const value of [row.farmer_code, row.account_number, row.voter_number]) {
      if (!value) continue;
      const normalized = normalizeFiveDigitIdentifier(value, 0);
      if (/^\d{5}$/.test(normalized)) existingCodes.add(normalized);
    }
  }
  const existingNids = new Set((existing ?? []).map((x: any) => x.nid).filter(Boolean));
  const existingNames = new Set((existing ?? []).map((x: any) => x.name_en?.toLowerCase()));
  const existingMobiles = new Set((existing ?? []).filter((x: any) => x.office_id === officeId).map((x: any) => x.mobile).filter(Boolean));

  const desired = customNames?.length ? customNames.slice(0, count) : null;
  const total = desired ? desired.length : count;

  const farmers: any[] = [];
  for (let i = 0; i < total; i++) {
    const isVoter = i % ratio === 0;
    const tokenCtx = { seq: i + 1, office: officeShort, year };
    const isFemale = i % 7 === 0;
    const fallback = isFemale ? pick(FEMALE_NAMES, i) : pick(MALE_NAMES, i);
    const custom = desired?.[i];
    const en = custom?.en?.trim() || fallback.en;
    const bn = custom?.bn?.trim() || fallback.bn;
    const father = custom?.father?.trim() || pick(FATHERS, i + 3).en;
    const mother = custom?.mother?.trim() || pick(MOTHERS, i + 5).en;
    const loc = locs.length ? locs[i % locs.length] : null;

    // Generate one unique 5-digit ID used as farmer_code, account_number and voter_number.
    let seq = i + 1;
    let code = normalizeFiveDigitIdentifier(formatToken(cfg.accountNumberFormat, { ...tokenCtx, seq }), seq);
    let guard = 0;
    while (existingCodes.has(code)) {
      seq++;
      const formatted = normalizeFiveDigitIdentifier(formatToken(cfg.accountNumberFormat, { ...tokenCtx, seq }), seq);
      const fallback = normalizeFiveDigitIdentifier("", seq);
      code = existingCodes.has(formatted) ? fallback : formatted;
      guard++;
      if (guard > 99999) throw new Error("No available 5-digit farmer identifiers remain");
    }
    existingCodes.add(code);

    const nid = custom?.nid?.trim() || `19900${String(1000000000 + i).padStart(10, "0")}`;
    if (existingNids.has(nid)) continue; // skip duplicate NID
    if (existingNames.has(en.toLowerCase()) && !custom) continue; // skip duplicate generated name
    existingNids.add(nid);
    existingNames.add(en.toLowerCase());

    // Generate unique mobile (skip duplicates within office)
    let mobile = custom?.mobile?.trim() || `017${String(10000000 + i).padStart(8, "0")}`;
    if (mobile && existingMobiles.has(mobile)) {
      let bump = i + 1;
      let candidate = `017${String(10000000 + i + bump * 100000).padStart(8, "0")}`;
      while (existingMobiles.has(candidate)) {
        bump++;
        candidate = `017${String(10000000 + i + bump * 100000).padStart(8, "0")}`;
      }
      mobile = candidate;
    }
    if (mobile) existingMobiles.add(mobile);

    farmers.push({
      farmer_code: code,
      member_no: code,
      name_en: en,
      name_bn: bn,
      father_name: father,
      mother_name: mother,
      mobile,
      nid,
      village: loc?.mouza_name ?? pick(VILLAGES, i),
      office_id: officeId,
      status: "active",
      is_voter: isVoter,
      // Single shared 5-digit value. Database triggers also enforce this permanently.
      account_number: code,
      voter_number: isVoter ? code : null,
      division_id: loc?.division_id ?? null,
      district_id: loc?.district_id ?? null,
      upazila_id: loc?.upazila_id ?? null,
      mouza_id: loc?.mouza_id ?? null,
    });
  }
  if (!farmers.length) return [];
  const { data, error } = await admin.from("farmers")
    .insert(farmers)
    .select("id, farmer_code, name_en, name_bn, is_voter, voter_number, account_number, mouza_id");
  if (error) throw new Error(`farmers: ${error.message}`);
  return data ?? [];
}

async function seedLandTypes(admin: any, officeId: string): Promise<{ id: string; code: string; rate: number }[]> {
  const rows = [
    { code: "HIGH",   name: "High Land",   name_bn: "উঁচু জমি",   sort_order: 1, rate: 1800 },
    { code: "MEDIUM", name: "Medium Land", name_bn: "মাঝারি জমি", sort_order: 2, rate: 1500 },
    { code: "LOW",    name: "Low Land",    name_bn: "নিচু জমি",   sort_order: 3, rate: 1200 },
  ];
  const out: { id: string; code: string; rate: number }[] = [];
  for (const r of rows) {
    const { data: existing } = await admin.from("land_types").select("id").eq("code", r.code).maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data, error } = await admin.from("land_types").insert({
        code: r.code, name: r.name, name_en: r.name, name_bn: r.name_bn,
        sort_order: r.sort_order, is_active: true, office_id: officeId,
      }).select("id").single();
      if (error) throw new Error(`land_types: ${error.message}`);
      id = data.id;
    }
    out.push({ id, code: r.code, rate: r.rate });
  }
  return out;
}

async function seedSeasonTypes(admin: any): Promise<{ id: string; code: string }[]> {
  const rows = [
    { code: "BORO", name: "Boro",  name_bn: "বোরো", sort_order: 1 },
    { code: "AMAN", name: "Aman",  name_bn: "আমন",  sort_order: 2 },
    { code: "AUS",  name: "Aus",   name_bn: "আউশ",  sort_order: 3 },
  ];
  const out: { id: string; code: string }[] = [];
  for (const r of rows) {
    const { data: existing } = await admin.from("irrigation_season_types").select("id").eq("code", r.code).maybeSingle();
    let id = existing?.id;
    if (!id) {
      const { data, error } = await admin.from("irrigation_season_types").insert({
        code: r.code, name: r.name, name_en: r.name, name_bn: r.name_bn,
        sort_order: r.sort_order, is_active: true,
      }).select("id").single();
      if (error) throw new Error(`irrigation_season_types: ${error.message}`);
      id = data.id;
    }
    out.push({ id, code: r.code });
  }
  return out;
}

async function seedPatwaris(admin: any, officeId: string, locs: LocPick[], desired?: number) {
  const names = [
    { en: "Md. Kamrul Hasan",  bn: "মোঃ কামরুল হাসান" },
    { en: "Md. Abdul Latif",   bn: "মোঃ আব্দুল লতিফ" },
    { en: "Md. Shahin Alam",   bn: "মোঃ শাহিন আলম" },
    { en: "Md. Bashir Ahmed",  bn: "মোঃ বশির আহমেদ" },
    { en: "Md. Rafiqul Islam", bn: "মোঃ রফিকুল ইসলাম" },
    { en: "Md. Jahangir Alam", bn: "মোঃ জাহাঙ্গীর আলম" },
    { en: "Md. Nazrul Haque",  bn: "মোঃ নজরুল হক" },
    { en: "Md. Saiful Mia",    bn: "মোঃ সাইফুল মিয়া" },
    { en: "Md. Anwar Hossain", bn: "মোঃ আনোয়ার হোসেন" },
    { en: "Md. Mizanur Rahman", bn: "মোঃ মিজানুর রহমান" },
  ];
  const count = Math.max(4, Math.min(desired ?? 4, locs.length || 4, names.length));
  const rows = Array.from({ length: count }, (_, i) => {
    const n = names[i % names.length];
    const loc = locs[i % Math.max(1, locs.length)];
    return {
      name: n.en, name_bn: n.bn,
      mobile: `018${String(20000000 + i).padStart(8, "0")}`,
      nid: `199${String(8000000000 + i).padStart(10, "0")}`,
      address: loc?.mouza_name ?? "",
      mouza_id: loc?.mouza_id ?? null,
      office_id: officeId, is_active: true,
    };
  });
  const { data, error } = await admin.from("patwaris").insert(rows).select("id");
  if (error) throw new Error(`patwaris: ${error.message}`);
  return data ?? [];
}

async function seedIrrigationChargeSettings(admin: any, officeId: string) {
  const { error } = await admin.from("irrigation_charge_settings").upsert({
    office_id: officeId,
    maintenance_percent: 5, canal_percent: 3,
    delay_fee_percent: 2, grace_days: 30, auto_apply_delay_fee: true,
  }, { onConflict: "office_id" });
  if (error) throw new Error(`irrigation_charge_settings: ${error.message}`);
}

async function seedLands(admin: any, officeId: string, farmers: any[], landTypes: { id: string; rate: number }[]) {
  const lands = farmers.map((f, i) => {
    const lt = landTypes[i % landTypes.length];
    return {
      farmer_id: f.id,
      land_size: 0.25 + (i % 8) * 0.25,
      mouza_id: f.mouza_id ?? null,
      dag_no: `D${100 + i}`,
      land_type_id: lt?.id ?? null,
      field_type: i % 3 === 0 ? "high_land" : i % 3 === 1 ? "medium_land" : "low_land",
      owner_type: "owner",
      office_id: officeId,
      owner_farmer_id: f.id,
    };
  });
  const { data, error } = await admin.from("lands").insert(lands).select("id, farmer_id, land_size, land_type_id, office_id, dag_no, mouza_id, field_type, owner_type, owner_farmer_id");
  if (error) throw new Error(`lands: ${error.message}`);
  return data ?? [];
}

async function seedLandRelations(admin: any, officeId: string, lands: any[], farmers: any[]) {
  // ~15% of lands have a sharecropper (borga) — picks a different voter farmer
  const voterIds = farmers.filter((f: any) => f.is_voter).map((f: any) => f.id);
  if (!voterIds.length) return 0;
  const rows = lands.filter((_, i) => i % 7 === 0).map((l, i) => {
    const sc = voterIds.find((id: string) => id !== l.farmer_id) ?? null;
    if (!sc) return null;
    return {
      land_id: l.id,
      owner_farmer_id: l.farmer_id,
      sharecropper_farmer_id: sc,
      share_percentage: 50,
      valid_from: new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10),
      office_id: officeId,
      note: "Demo borga relationship",
    };
  }).filter(Boolean);
  if (!rows.length) return 0;
  const { error } = await admin.from("land_relations").insert(rows);
  if (error) throw new Error(`land_relations: ${error.message}`);
  return rows.length;
}

async function seedIrrigation(admin: any, officeId: string, farmers: any[], landTypes: { id: string; rate: number }[], seasonTypes: { id: string; code: string }[]) {
  const year = new Date().getFullYear();
  const seasonTypeId = seasonTypes.find((s) => s.code === "BORO")?.id ?? seasonTypes[0]?.id;
  const { data: season } = await admin.from("seasons")
    .upsert({
      year, type: "boro", name: `Boro ${year}`,
      season_type_id: seasonTypeId,
      fiscal_year: `${year}-${year + 1}`,
      start_date: `${year}-01-01`,
      end_date: `${year}-06-30`,
      due_date: `${year}-07-31`,
      status: "active",
    }, { onConflict: "year,type" }).select("id").single();
  if (!season) return;

  // Per-land-type season rates
  const rates = landTypes.map((lt) => ({
    irrigation_season_id: season.id,
    land_type_id: lt.id,
    office_id: officeId,
    rate_per_shotok: lt.rate,
  }));
  await admin.from("irrigation_season_rates").insert(rates);

  // Legacy irrigation_rates row (kept for back-compat)
  await admin.from("irrigation_rates").insert({
    season_id: season.id, office_id: officeId, basis: "per_size",
    base_rate: 1500, canal_charge: 100, maintenance_charge: 50, other_charge: 0,
  });

  // Legacy irrigation_charges (still referenced by some reports)
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

  return season.id as string;
}

async function seedIrrigationInvoices(admin: any, officeId: string, seasonId: string, landTypes: { id: string; rate: number }[]) {
  if (!seasonId) return 0;
  // Load lands with their owner + type
  const { data: lands } = await admin.from("lands")
    .select("id, farmer_id, owner_farmer_id, land_size, land_type_id, office_id, dag_no")
    .eq("office_id", officeId);
  if (!lands?.length) return 0;

  // Land-type names (for receipt "জমির ধরন" row) + borga lands (for owner/borgadar display)
  const { data: ltRows } = await admin.from("land_types")
    .select("id, name_bn, name").eq("office_id", officeId);
  const ltNameMap = new Map<string, string>(
    (ltRows ?? []).map((r: any) => [r.id, r.name_bn || r.name || ""]),
  );
  const { data: relRows } = await admin.from("land_relations")
    .select("land_id, sharecropper_farmer_id").eq("office_id", officeId);
  const borgaMap = new Map<string, string>(
    (relRows ?? []).map((r: any) => [r.land_id, r.sharecropper_farmer_id]),
  );

  const rateMap = new Map(landTypes.map((lt) => [lt.id, lt.rate]));
  const today = new Date();
  const dueDate = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const ts = today.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

  const invoices = lands.map((l: any, i: number) => {
    const size = Number(l.land_size) || 1;
    const rate = rateMap.get(l.land_type_id) ?? 1500;
    const irrigation = +(rate * size).toFixed(2);
    const maintenance = +(irrigation * 0.05).toFixed(2);
    const canal = +(irrigation * 0.03).toFixed(2);
    // Current-season penalty (হাল জরিমানা) on every 3rd invoice
    const hasPenalty = i % 3 === 2;
    const delayFee = hasPenalty ? +(irrigation * 0.02).toFixed(2) : 0;
    // Carried-forward due from last season (বকেয়া) on every 5th invoice
    const previousDue = i % 5 === 0 ? +(irrigation * 0.5).toFixed(2) : 0;
    const payable = +(irrigation + maintenance + canal + delayFee + previousDue).toFixed(2);
    const isPaid = i % 4 === 0;
    const isPartial = i % 4 === 1;
    const paid = isPaid ? payable : isPartial ? +(payable * 0.5).toFixed(2) : 0;
    const sharecropper = borgaMap.get(l.id) ?? null;
    const isBorga = !!sharecropper;
    return {
      invoice_no: `INV-${ts}-${String(i + 1).padStart(4, "0")}`,
      office_id: officeId,
      season_id: seasonId,
      land_id: l.id,
      owner_farmer_id: l.owner_farmer_id ?? l.farmer_id,
      // For borga lands the sharecropper (বর্গাদার) is the paying farmer
      farmer_id: isBorga ? sharecropper : l.farmer_id,
      is_borga: isBorga,
      irrigation_amount: irrigation,
      maintenance_amount: maintenance,
      canal_amount: canal,
      delay_fee: delayFee, other_charge: 0,
      previous_due_amount: previousDue,
      payable_amount: payable,
      paid_amount: paid,
      due_amount: +(payable - paid).toFixed(2),
      due_date: dueDate,
      invoice_status: isPaid ? "paid" : isPartial ? "partial_paid" : "generated",
      land_type_id: l.land_type_id,
      land_type_name: ltNameMap.get(l.land_type_id) ?? null,
      irrigation_category_name: ltNameMap.get(l.land_type_id) ?? null,
      season_rate: rate,
      // Freeze the billed land area on the invoice so later land edits never
      // retroactively change this (past-season) invoice's displayed area.
      calculation_snapshot: {
        rate_per_shotok: rate,
        land_size_shotok: size,
        parcel_size_shotok: size,
        billed_area_shotok: size,
        is_borga_split: isBorga,
        generated_at: today.toISOString(),
      },
    };
  });


  const { data: ins, error } = await admin.from("irrigation_invoices").insert(invoices).select("id, paid_amount, irrigation_amount, maintenance_amount, canal_amount, office_id");
  if (error) throw new Error(`irrigation_invoices: ${error.message}`);

  // Record payment rows for those that were paid
  const payRows = (ins ?? [])
    .filter((inv: any) => Number(inv.paid_amount) > 0)
    .map((inv: any) => ({
      invoice_id: inv.id,
      collected_amount: inv.paid_amount,
      irrigation_collected: inv.irrigation_amount,
      maintenance_collected: inv.maintenance_amount,
      canal_collected: inv.canal_amount,
      delay_fee_collected: 0,
      office_id: inv.office_id,
    }));
  if (payRows.length) {
    const { error: payErr } = await admin.from("irrigation_invoice_payments").insert(payRows);
    if (payErr) throw new Error(`irrigation_invoice_payments: ${payErr.message}`);
  }
  return invoices.length;
}

async function seedLoans(admin: any, officeId: string, farmers: any[], monthsBack: number = 1) {
  const voters = farmers.filter((f: any) => f.is_voter);
  const seeded: string[] = [];
  // Seed 3 plans (6/12/24 months)
  const planDefs = [
    { name: "Short Term 6mo", name_bn: "৬ মাসের স্বল্প-মেয়াদী", duration_months: 6,  interest_rate: 10, installment_type: "monthly", penalty_type: "percentage", penalty_value: 2, grace_period_days: 5,  is_active: true, office_id: officeId },
    { name: "Standard 12mo",  name_bn: "১২ মাসের সাধারণ",       duration_months: 12, interest_rate: 12, installment_type: "monthly", penalty_type: "percentage", penalty_value: 2, grace_period_days: 7,  is_active: true, office_id: officeId },
    { name: "Long Term 24mo", name_bn: "২৪ মাসের দীর্ঘ-মেয়াদী", duration_months: 24, interest_rate: 14, installment_type: "monthly", penalty_type: "fixed",      penalty_value: 100, grace_period_days: 10, is_active: true, office_id: officeId },
  ];
  const { data: plans, error: plansErr } = await admin.from("loan_plans").insert(planDefs).select("id, duration_months, interest_rate");
  if (plansErr) throw new Error(`loan_plans: ${plansErr.message}`);
  const planList = plans ?? [];
  const planId = planList[1]?.id ?? planList[0]?.id ?? null;
  const targets = voters.slice(0, Math.ceil(voters.length * 0.4));
  const now = Date.now();
  const loanRows = targets.map((f, i) => {
    const p = planList[i % Math.max(1, planList.length)] ?? { id: planId, duration_months: 12, interest_rate: 12 };
    const principal = 10000 + (i % 5) * 5000;
    const totalPay = principal * (1 + Number(p.interest_rate) / 100);
    seeded.push(f.id);
    // Spread issued_on across last `monthsBack` months when > 1
    const monthsAgo = monthsBack > 1 ? (i % monthsBack) : 6;
    const issued = new Date(now - monthsAgo * 30 * 86400000).toISOString().slice(0, 10);
    const isTemp = i % 6 === 5; // ~17% temporary loans
    return {
      farmer_id: f.id, principal, interest_rate: p.interest_rate, total_payable: totalPay, total_due: totalPay,
      installment_amount: totalPay / p.duration_months, plan_id: p.id,
      status: i % 4 === 0 ? "pending" : "approved", office_id: officeId,
      issued_on: issued,
      is_temporary: isTemp,
      temp_purpose: isTemp ? (i % 2 === 0 ? "জরুরি কৃষি উপকরণ" : "অস্থায়ী চাষাবাদ সহায়তা") : null,
    };
  });

  if (loanRows.length) {
    // Seed default delay-fee settings (idempotent per office)
    await admin.from("loan_delay_fee_settings").upsert({
      office_id: officeId,
      mode: "combined",
      value: 2,            // 2% of installment
      daily_penalty: 10,   // ৳10 per day
      grace_days: 5,
      max_penalty: 1000,
      auto_apply: true,
      allow_partial_installment: false,
      enforcement_mode: "block",
    }, { onConflict: "office_id" });

    const { data: ins } = await admin.from("loans").insert(loanRows).select("id, total_payable, status, issued_on, installment_amount");
    // Generate installment schedules + payments
    const allInst: any[] = [];
    const pays: any[] = [];
    const today = new Date();
    for (const l of (ins ?? [])) {
      if (l.status !== "approved") continue;
      const totalPay = Number(l.total_payable);
      const monthly = +(Number(l.installment_amount) || (totalPay / 12)).toFixed(2);
      const duration = Math.max(1, Math.round(totalPay / monthly));
      const start = l.issued_on ? new Date(l.issued_on) : new Date(today.getTime() - 180 * 86400000);
      // 12 installments; first 3 paid, the past-due remaining ones become overdue, future ones stay due
      const paidCount = Math.min(3, Math.max(1, Math.floor(duration / 4)));
      for (let n = 1; n <= duration; n++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + n);
        const paid = n <= paidCount;
        const isOverdue = !paid && due < today;
        const overdueDays = isOverdue ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;
        // Combined penalty: 2% of monthly + 10/day beyond 5-day grace, capped at 1000
        const billable = Math.max(0, overdueDays - 5);
        const penalty = isOverdue
          ? Math.min(1000, +(monthly * 0.02 + billable * 10).toFixed(2))
          : 0;
        allInst.push({
          loan_id: l.id,
          installment_no: n,
          amount: monthly,
          paid_amount: paid ? monthly : 0,
          due_date: due.toISOString().slice(0, 10),
          paid_on: paid ? new Date(due.getTime() - 2 * 86400000).toISOString().slice(0, 10) : null,
          status: paid ? "paid" : "due",
          penalty_amount: penalty,
          overdue_days: overdueDays,
          office_id: officeId,
        });
      }
      // Corresponding loan_payments rows
      for (let n = 1; n <= paidCount; n++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + n);
        pays.push({
          loan_id: l.id, amount: monthly, office_id: officeId,
          paid_on: new Date(due.getTime() - 2 * 86400000).toISOString().slice(0, 10),
          penalty_collected: 0,
        });
      }
    }
    if (allInst.length) await admin.from("loan_installments").insert(allInst);
    if (pays.length) await admin.from("loan_payments").insert(pays);
  }
  return seeded;
}

async function seedSavings(admin: any, officeId: string, farmers: any[], monthsBack: number = 1) {
  const voters = farmers.filter((f: any) => f.is_voter);
  const savingsSeeded: string[] = [];
  const sharesSeeded: string[] = [];
  const fspSeeded: string[] = [];
  const planSpecs = [
    { name: "DPS 12",  name_bn: "ডিপিএস ১২", office_id: officeId, duration_months: 12, installment_type: "monthly", installment_amount: 300, interest_rate: 5, maturity_type: "simple", is_active: true },
    { name: "DPS 24",  name_bn: "ডিপিএস ২৪", office_id: officeId, duration_months: 24, installment_type: "monthly", installment_amount: 500, interest_rate: 6, maturity_type: "simple", is_active: true },
    { name: "FDR 36",  name_bn: "এফডিআর ৩৬", office_id: officeId, duration_months: 36, installment_type: "monthly", installment_amount: 1000, interest_rate: 8, maturity_type: "compound", is_active: true },
  ];
  const { data: plans } = await admin.from("savings_plans").insert(planSpecs).select("id, duration_months, installment_amount, interest_rate");
  const planList = plans ?? [];

  // Enroll ~30% of voters across all plans (round-robin)
  if (planList.length) {
    const enrollTargets = voters.slice(0, Math.ceil(voters.length * 0.3));
    const fspRows = enrollTargets.map((f, i) => {
      const p = planList[i % planList.length];
      const expected = Number(p.installment_amount) * Number(p.duration_months);
      const interest = +(expected * Number(p.interest_rate) / 100 / 2).toFixed(2);
      fspSeeded.push(f.id);
      // Spread enrollment start_date across the operational window
      const monthsAgo = monthsBack > 1 ? (i % monthsBack) : 1;
      return {
        plan_id: p.id, farmer_id: f.id, office_id: officeId,
        start_date: new Date(Date.now() - monthsAgo * 30 * 86400000).toISOString().slice(0, 10),
        expected_total: expected,
        expected_interest: interest,
        maturity_amount: expected + interest,
        status: i % 4 === 0 ? "pending" : "approved",
      };
    });
    if (fspRows.length) {
      const { error } = await admin.from("farmer_savings_plans").insert(fspRows);
      if (error) throw new Error(`farmer_savings_plans: ${error.message}`);
    }
  }

  const targets = voters.slice(0, Math.ceil(voters.length * 0.6));
  const CATS = ["general", "hawlat", "bank", "donation", "misc"];
  const today = new Date();
  const txns = targets.flatMap((f, i) => {
    savingsSeeded.push(f.id);
    const rows: any[] = [];
    if (monthsBack > 1) {
      // Monthly recurring deposit for each of the last N months
      const baseAmt = 200 + (i % 5) * 50;
      for (let m = monthsBack - 1; m >= 0; m--) {
        const d = new Date(today.getFullYear(), today.getMonth() - m, 5);
        rows.push({
          farmer_id: f.id, type: "deposit", amount: baseAmt,
          status: "approved", office_id: officeId, category: CATS[i % CATS.length],
          txn_date: d.toISOString().slice(0, 10),
        });
      }
      // Occasional withdrawal/share collection
      if (i % 4 === 0) {
        const d = new Date(today.getFullYear(), today.getMonth() - Math.floor(monthsBack / 2), 15);
        rows.push({ farmer_id: f.id, type: "withdraw", amount: 300, status: "approved", office_id: officeId, category: "general", txn_date: d.toISOString().slice(0, 10) });
      }
      if (i % 3 === 0) {
        const d = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 10);
        rows.push({ farmer_id: f.id, type: "share_collection", amount: 500, status: "approved", office_id: officeId, note: "Demo share collection", category: "general", txn_date: d.toISOString().slice(0, 10) });
      }
    } else {
      // Legacy point-in-time
      rows.push({ farmer_id: f.id, type: "deposit", amount: 1000 + (i % 5) * 200, status: "approved", office_id: officeId, category: CATS[i % CATS.length] });
      if (i % 4 === 0) rows.push({ farmer_id: f.id, type: "withdraw", amount: 300, status: "approved", office_id: officeId, category: "general" });
      if (i % 3 === 0) rows.push({ farmer_id: f.id, type: "share_collection", amount: 500, status: "approved", office_id: officeId, note: "Demo share collection", category: "general" });
    }
    return rows;
  });
  if (txns.length) {
    const { error } = await admin.from("savings_transactions").insert(txns);
    if (error) throw new Error(`savings_transactions: ${error.message}`);
  }
  const shareTargets = voters.slice(0, Math.ceil(voters.length * 0.5));
  const shareRows = shareTargets.map((f) => { sharesSeeded.push(f.id); return { farmer_id: f.id, balance: 500, office_id: officeId }; });
  if (shareRows.length) await admin.from("shares").insert(shareRows);
  return { savingsSeeded, sharesSeeded, fspSeeded };
}


async function seedPayments(admin: any, officeId: string, farmers: any[], monthsBack: number = 1) {
  if (!farmers.length) return;
  const voters = farmers.filter((f: any) => f.is_voter);
  const today = new Date();
  const dateAt = (m: number, d: number) =>
    new Date(today.getFullYear(), today.getMonth() - m, d).toISOString();
  const rows = voters.flatMap((f, i) => {
    const out: any[] = [];
    if (monthsBack > 1) {
      // Spread payments across the operational window
      for (let m = 0; m < monthsBack; m++) {
        if ((i + m) % 3 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 500 + (i % 5) * 100, status: "approved", office_id: officeId, created_at: dateAt(m, 7 + (i % 20)) });
        if ((i + m) % 5 === 0) out.push({ farmer_id: f.id, kind: "loan",       amount: 1000,                 status: "approved", office_id: officeId, created_at: dateAt(m, 12 + (i % 15)) });
        if ((i + m) % 4 === 0) out.push({ farmer_id: f.id, kind: "savings",    amount: 500,                  status: "approved", office_id: officeId, created_at: dateAt(m, 20 + (i % 8)) });
      }
    } else {
      const todayIso = today.toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const earlierMonth = new Date(Date.now() - 10 * 86400000).toISOString();
      if (i % 3 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 500 + (i % 5) * 100, status: "approved", office_id: officeId, created_at: todayIso });
      if (i % 5 === 0) out.push({ farmer_id: f.id, kind: "loan", amount: 1000, status: "approved", office_id: officeId, created_at: todayIso });
      if (i % 2 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 800, status: "approved", office_id: officeId, created_at: earlierMonth });
      if (i % 4 === 0) out.push({ farmer_id: f.id, kind: "savings", amount: 500, status: "approved", office_id: officeId, created_at: yesterday });
    }
    return out;
  });
  if (rows.length) {
    const { error } = await admin.from("payments").insert(rows);
    if (error) throw new Error(`payments: ${error.message}`);
  }
}


// After import, verify integrity: every farmer with savings/loans/shares MUST have is_voter=true,
// and every voter MUST have voter_number + account_number.
async function verifyVoterIntegrity(admin: any): Promise<{ ok: boolean; issues: string[] }> {
  const issues: string[] = [];
  const { data: badSav } = await admin.from("savings_transactions")
    .select("farmer_id, farmers!inner(farmer_code, is_voter)").eq("farmers.is_voter", false).limit(10);
  if (badSav?.length) issues.push(`${badSav.length}+ savings_transactions for non-voter farmers`);
  const { data: badLoan } = await admin.from("loans")
    .select("farmer_id, farmers!inner(farmer_code, is_voter)").eq("farmers.is_voter", false).limit(10);
  if (badLoan?.length) issues.push(`${badLoan.length}+ loans for non-voter farmers`);
  const { data: badShare } = await admin.from("shares")
    .select("farmer_id, farmers!inner(farmer_code, is_voter)").eq("farmers.is_voter", false).limit(10);
  if (badShare?.length) issues.push(`${badShare.length}+ shares for non-voter farmers`);
  const { data: missingNo } = await admin.from("farmers")
    .select("farmer_code, voter_number, account_number").eq("is_voter", true)
    .or("voter_number.is.null,account_number.is.null").limit(10);
  if (missingNo?.length) issues.push(`${missingNo.length}+ voter farmers missing voter_number/account_number`);
  return { ok: issues.length === 0, issues };
}

async function seedBankAccounts(admin: any, officeId: string, monthsBack: number = 1) {
  const existing = await admin.from("bank_accounts").select("id").eq("office_id", officeId).limit(1);
  if (existing.data && existing.data.length) return { accounts: 0, txns: 0 };
  const accountsSpec = [
    { office_id: officeId, bank_name: "Sonali Bank", branch: "Rangpur", account_no: "1011000001", account_title: "Baliadanga Branch — Main", account_type: "savings", opening_balance: 50000 },
    { office_id: officeId, bank_name: "Janata Bank", branch: "Rangpur", account_no: "2022000002", account_title: "Baliadanga Branch — Operating", account_type: "current", opening_balance: 25000 },
    { office_id: officeId, bank_name: "Agrani Bank", branch: "Rangpur", account_no: "3033000003", account_title: "Baliadanga Branch — Reserve", account_type: "savings", opening_balance: 100000 },
  ];
  const { data: accts, error } = await admin.from("bank_accounts").insert(accountsSpec).select("id");
  if (error) throw new Error(`bank_accounts: ${error.message}`);
  const txns: any[] = [];
  const today = new Date();
  const dateAt = (m: number, d: number) =>
    new Date(today.getFullYear(), today.getMonth() - m, d).toISOString().slice(0, 10);
  let refSeq = 1;
  (accts ?? []).forEach((a: any, i: number) => {
    if (monthsBack > 1) {
      // Monthly cycle: 1 deposit, 1 withdraw, occasional interest
      for (let m = monthsBack - 1; m >= 0; m--) {
        txns.push({ office_id: officeId, bank_account_id: a.id, txn_type: "deposit",  amount: 8000 + i * 1500 + (m % 3) * 500, reference_no: `DEP-${1000 + refSeq++}`, note: "Demo monthly deposit", txn_date: dateAt(m, 5) });
        txns.push({ office_id: officeId, bank_account_id: a.id, txn_type: "withdraw", amount: 2500 + i * 400  + (m % 4) * 300, reference_no: `WD-${2000 + refSeq++}`,  note: "Demo monthly withdraw", txn_date: dateAt(m, 20) });
        if (m % 3 === 0) {
          txns.push({ office_id: officeId, bank_account_id: a.id, txn_type: "interest", amount: 150 + i * 50, reference_no: `INT-${3000 + refSeq++}`, note: "Demo quarterly interest", txn_date: dateAt(m, 28) });
        }
      }
    } else {
      txns.push(
        { office_id: officeId, bank_account_id: a.id, txn_type: "deposit",  amount: 10000 + i * 2000, reference_no: `DEP-${1000 + i}`, note: "Demo deposit" },
        { office_id: officeId, bank_account_id: a.id, txn_type: "withdraw", amount: 3000 + i * 500,   reference_no: `WD-${2000 + i}`,  note: "Demo withdraw" },
      );
    }
  });
  if (txns.length) {
    const { error: e2 } = await admin.from("bank_transactions").insert(txns);
    if (e2) throw new Error(`bank_transactions: ${e2.message}`);
  }
  return { accounts: (accts ?? []).length, txns: txns.length };
}


async function seedFarmerNotes(admin: any, farmers: any[]) {
  const targets = farmers.slice(0, Math.min(10, farmers.length));
  if (!targets.length) return 0;
  const rows = targets.map((f: any, i: number) => ({
    farmer_id: f.id,
    note: i % 3 === 0 ? "নিয়মিত সেচ ব্যবহার করেন।" : i % 3 === 1 ? "গত মৌসুমে বকেয়া পরিশোধ করেছেন।" : "সক্রিয় সদস্য — যোগাযোগ মোবাইলে।",
    pinned: i === 0,
  }));
  const { error } = await admin.from("farmer_notes").insert(rows);
  if (error) return 0;
  return rows.length;
}

async function seedExpenses(admin: any, officeId: string, monthsBack: number = 1) {
  const today = new Date();
  const dateAt = (m: number, d: number) =>
    new Date(today.getFullYear(), today.getMonth() - m, d).toISOString().slice(0, 10);
  // Stream-tagged heads so BOTH the Irrigation and Society income-expense cash
  // books / cash statements populate their columns. Irrigation heads match the
  // keyword mapping used by the irrigation cash book report.
  const irr = [
    { head: "শ্রমিক মজুরি", amount: 1500, payee: "শ্রমিক", day: 3 },
    { head: "যন্ত্রাংশ ক্রয়", amount: 2200, payee: "যন্ত্রাংশ দোকান", day: 6 },
    { head: "যন্ত্রাংশ মেরামত", amount: 900, payee: "মিস্ত্রি", day: 9 },
    { head: "যাতায়াত", amount: 400, payee: "—", day: 12 },
    { head: "বিদ্যুৎ বিল", amount: 1800, payee: "পল্লী বিদ্যুৎ", day: 15 },
  ];
  const soc = [
    { head: "অফিস ভাড়া", amount: 5000, payee: "বাড়িওয়ালা", day: 1 },
    { head: "বেতন ও ভাতা", amount: 8000, payee: "কর্মচারী", day: 10 },
    { head: "স্টেশনারি", amount: 800, payee: "স্থানীয় দোকান", day: 18 },
  ];
  const rows: any[] = [];
  let vseq = 1;
  const months = monthsBack > 1 ? monthsBack : 1;
  for (let m = months - 1; m >= 0; m--) {
    for (const h of irr) rows.push({ head: h.head, amount: h.amount, payee: h.payee, office_id: officeId, stream: "irrigation", is_bank_deposit: false, voucher_no: `V-I-${vseq++}`, note: "Demo", expense_date: dateAt(m, h.day) });
    for (const h of soc) rows.push({ head: h.head, amount: h.amount, payee: h.payee, office_id: officeId, stream: "savings", is_bank_deposit: false, voucher_no: `V-S-${vseq++}`, note: "Demo", expense_date: dateAt(m, h.day) });
    rows.push({ head: "ব্যাংক জমা", amount: 3000, payee: "ব্যাংক", office_id: officeId, stream: "irrigation", is_bank_deposit: true, voucher_no: `V-I-${vseq++}`, note: "Demo bank deposit", expense_date: dateAt(m, 25) });
  }
  const { error } = await admin.from("expenses").insert(rows);
  if (error) throw new Error(`expenses: ${error.message}`);
  return rows.length;
}

// Seeds the data behind the cash reports: Cash Book, Hand Cash, Cash Audit,
// Cash Statement (Irrigation/Society) and the Income-Expense Cash Books.
// Covers office_incomes (sech + saving), receipts (income side) and the
// monthly cashbook/hand-cash submissions.
async function seedCashReports(admin: any, officeId: string, farmers: any[], monthsBack: number = 1) {
  const today = new Date();
  const dateAt = (m: number, d: number) =>
    new Date(today.getFullYear(), today.getMonth() - m, d).toISOString().slice(0, 10);
  const months = monthsBack > 1 ? monthsBack : 1;
  const voters = (farmers ?? []).filter((f: any) => f.is_voter);
  const out: Record<string, number> = { office_incomes: 0, receipts: 0, cashbook_submissions: 0, hand_cash_submissions: 0 };

  // 1) Office incomes — irrigation (stream=sech) + society (stream=saving)
  const oi: any[] = [];
  let oiSeq = 1;
  for (let m = months - 1; m >= 0; m--) {
    const ym = dateAt(m, 1).slice(0, 7);
    oi.push({ office_id: officeId, receipt_no: `OI-${ym}-${oiSeq++}`, income_type: "নালা চার্জ", payer_name: "মাঠ কমিটি", amount: 1200, received_on: dateAt(m, 4), stream: "sech" });
    oi.push({ office_id: officeId, receipt_no: `OI-${ym}-${oiSeq++}`, income_type: "পুকুর ইজারা", payer_name: "ইজারাদার", amount: 2000, received_on: dateAt(m, 8), stream: "sech" });
    oi.push({ office_id: officeId, receipt_no: `OI-${ym}-${oiSeq++}`, income_type: "বিবিধ আয়", payer_name: "সমিতি", amount: 700, received_on: dateAt(m, 14), stream: "saving" });
    oi.push({ office_id: officeId, receipt_no: `OI-${ym}-${oiSeq++}`, income_type: "ফরম বিক্রয়", payer_name: "সদস্য", amount: 300, received_on: dateAt(m, 21), stream: "saving" });
  }
  if (oi.length) {
    const { error } = await admin.from("office_incomes").insert(oi);
    if (error) throw new Error(`office_incomes: ${error.message}`);
    out.office_incomes = oi.length;
  }

  // 2) Receipts — income side for Cash Book / Hand Cash / Cash Audit.
  // receipt_no is auto-generated by the set_receipt_no trigger; don't set it.
  const kinds = ["irrigation", "savings_deposit", "share", "donation", "pond"];
  const rec: any[] = [];
  voters.forEach((f: any, i: number) => {
    for (let m = months - 1; m >= 0; m--) {
      if ((i + m) % 4 === 0) {
        rec.push({ kind: pick(kinds, i + m), farmer_id: f.id, amount: 300 + (i % 6) * 50, method: "cash", office_id: officeId, receipt_date: dateAt(m, 6 + (i % 18)) });
      }
    }
  });
  const recCapped = rec.slice(0, Math.max(20, months * 15));
  if (recCapped.length) {
    const { error } = await admin.from("receipts").insert(recCapped);
    if (error) throw new Error(`receipts: ${error.message}`);
    out.receipts = recCapped.length;
  }

  // 3) Monthly cashbook submissions (unique year,month) — skip the current open month.
  const cb: any[] = [];
  for (let m = months; m >= 1; m--) {
    const dt = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const income = 8000 + (m % 3) * 1500;
    const expense = 5000 + (m % 4) * 800;
    cb.push({ year: dt.getFullYear(), month: dt.getMonth() + 1, stream: "all", opening_cash: 10000, total_income: income, total_expense: expense, closing_cash: 10000 + income - expense, locked: true, note: "Demo monthly cashbook" });
  }
  if (cb.length) {
    const { error } = await admin.from("cashbook_submissions").upsert(cb, { onConflict: "year,month", ignoreDuplicates: true });
    if (!error) out.cashbook_submissions = cb.length;
  }

  // 4) Monthly hand-cash submissions (unique office_id,year,month).
  const hc: any[] = [];
  for (let m = months; m >= 1; m--) {
    const dt = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const income = 6000 + (m % 3) * 1000;
    const expense = 3500 + (m % 4) * 600;
    hc.push({ office_id: officeId, year: dt.getFullYear(), month: dt.getMonth() + 1, opening_cash: 5000, total_income: income, total_expense: expense, closing_cash: 5000 + income - expense, locked: m > 1 });
  }
  if (hc.length) {
    const { error } = await admin.from("hand_cash_submissions").upsert(hc, { onConflict: "office_id,year,month", ignoreDuplicates: true });
    if (!error) out.hand_cash_submissions = hc.length;
  }

  return out;
}



// ---- ASSETS module seeder ----
// Seeds categories, assets, stock, purchases, monthly depreciation schedule,
// maintenance logs, movements, installations and a disposal so the whole
// Assets module + year-end depreciation reports light up.
async function seedAssets(admin: any, officeId: string, monthsBack: number = 1) {
  // Skip if already seeded for this office (idempotent)
  const probe = await admin.from("assets").select("id").eq("office_id", officeId).limit(1);
  if (probe.data && probe.data.length) {
    return { categories: 0, assets: 0, purchases: 0, movements: 0, maintenance: 0, depreciation: 0, disposals: 0, skipped: true };
  }

  const today = new Date();
  const dateAt = (m: number, d: number) =>
    new Date(today.getFullYear(), today.getMonth() - m, d).toISOString().slice(0, 10);
  const monthFirst = (m: number) =>
    new Date(today.getFullYear(), today.getMonth() - m, 1).toISOString().slice(0, 10);

  // 1) Categories
  const catSpec = [
    { code: "PUMP",   name_en: "Irrigation Pumps", name_bn: "সেচ পাম্প",      tracking_mode: "serial",   asset_type: "fixed_asset" },
    { code: "MOTOR",  name_en: "Electric Motors",  name_bn: "ইলেকট্রিক মোটর", tracking_mode: "serial",   asset_type: "fixed_asset" },
    { code: "PIPE",   name_en: "Pipes & Fittings", name_bn: "পাইপ ও ফিটিং",   tracking_mode: "quantity", asset_type: "consumable" },
    { code: "SPARE",  name_en: "Spare Parts",      name_bn: "যন্ত্রাংশ",       tracking_mode: "quantity", asset_type: "inventory" },
  ];
  const { data: cats, error: catErr } = await admin.from("asset_categories")
    .insert(catSpec.map((c) => ({ office_id: officeId, code: c.code, name_en: c.name_en, name_bn: c.name_bn, tracking_mode: c.tracking_mode, is_active: true })))
    .select("id, code");
  if (catErr) throw new Error(`asset_categories: ${catErr.message}`);
  const catMap: Record<string, string> = {};
  for (const c of (cats ?? [])) catMap[c.code] = c.id;

  // 2) Assets (mix of fixed + consumable + inventory)
  const assetSpec: any[] = [
    { code: "PMP-001", cat: "PUMP",  name_en: "Centrifugal Pump 5HP",  name_bn: "সেন্ট্রিফিউগাল পাম্প ৫HP",  tracking: "serial",   type: "fixed_asset", price: 65000, life: 60, salvage: 5000, unit: "pcs",  qty: 1 },
    { code: "PMP-002", cat: "PUMP",  name_en: "Submersible Pump 3HP",  name_bn: "সাবমার্সিবল পাম্প ৩HP",     tracking: "serial",   type: "fixed_asset", price: 48000, life: 60, salvage: 4000, unit: "pcs",  qty: 1 },
    { code: "MOT-001", cat: "MOTOR", name_en: "Electric Motor 5HP",    name_bn: "ইলেকট্রিক মোটর ৫HP",       tracking: "serial",   type: "fixed_asset", price: 32000, life: 72, salvage: 2500, unit: "pcs",  qty: 1 },
    { code: "MOT-002", cat: "MOTOR", name_en: "Electric Motor 3HP (old)", name_bn: "পুরাতন মোটর ৩HP",     tracking: "serial",   type: "fixed_asset", price: 22000, life: 60, salvage: 1500, unit: "pcs",  qty: 1, retire: true },
    { code: "PIPE-PVC-4", cat: "PIPE", name_en: "PVC Pipe 4 inch",     name_bn: "পিভিসি পাইপ ৪ ইঞ্চি",     tracking: "quantity", type: "consumable",  price: 320,   life: 0,  salvage: 0,    unit: "ft",   qty: 500 },
    { code: "PIPE-PVC-6", cat: "PIPE", name_en: "PVC Pipe 6 inch",     name_bn: "পিভিসি পাইপ ৬ ইঞ্চি",     tracking: "quantity", type: "consumable",  price: 520,   life: 0,  salvage: 0,    unit: "ft",   qty: 300 },
    { code: "SPR-IMP-01", cat: "SPARE", name_en: "Pump Impeller",       name_bn: "পাম্প ইমপেলার",            tracking: "quantity", type: "inventory",   price: 1800,  life: 0,  salvage: 0,    unit: "pcs",  qty: 12 },
    { code: "SPR-BRG-01", cat: "SPARE", name_en: "Motor Bearing Set",   name_bn: "মোটর বিয়ারিং সেট",        tracking: "quantity", type: "inventory",   price: 950,   life: 0,  salvage: 0,    unit: "set",  qty: 20 },
  ];

  const assetRows = assetSpec.map((a, i) => ({
    office_id: officeId,
    asset_category_id: catMap[a.cat],
    asset_code: a.code,
    serial_no: a.tracking === "serial" ? `SN-${a.code}-${1000 + i}` : null,
    name_en: a.name_en,
    name_bn: a.name_bn,
    tracking_mode: a.tracking,
    asset_type: a.type,
    unit: a.unit,
    purchase_price: a.price,
    current_status: a.retire ? "disposed" : (a.tracking === "serial" ? "installed" : "in_stock"),
    min_stock_level: a.tracking === "quantity" ? Math.max(5, Math.floor(a.qty * 0.1)) : 0,
  }));
  const { data: assets, error: aErr } = await admin.from("assets").insert(assetRows).select("id, asset_code, purchase_price, asset_type, tracking_mode");
  if (aErr) throw new Error(`assets: ${aErr.message}`);
  const A: Record<string, any> = {};
  for (const x of (assets ?? [])) A[x.asset_code] = x;

  // 3) Stocks
  const stockRows = assetSpec.map((a) => ({
    office_id: officeId, asset_id: A[a.code].id, location_id: null,
    quantity: a.retire ? 0 : a.qty,
  }));
  await admin.from("asset_stocks").insert(stockRows);

  // 4) Purchases — for fixed assets at the very start of window;
  // consumables/inventory get monthly small restocks across the window.
  const purchases: any[] = [];
  let invSeq = 1;
  const startMonth = Math.max(1, monthsBack);
  for (const a of assetSpec) {
    if (a.type === "fixed_asset") {
      purchases.push({
        office_id: officeId, asset_id: A[a.code].id,
        purchase_date: dateAt(startMonth - 1, 5),
        quantity: 1, unit_price: a.price, total_amount: a.price,
        supplier: "Demo Supplier Co.", invoice_no: `PO-${1000 + invSeq++}`,
        payment_method: "bank", notes: "Demo initial purchase",
      });
    } else if (monthsBack > 1) {
      // monthly small restock every 2-3 months
      for (let m = monthsBack - 1; m >= 0; m -= 3) {
        const restockQty = Math.max(10, Math.floor(a.qty / 4));
        purchases.push({
          office_id: officeId, asset_id: A[a.code].id,
          purchase_date: dateAt(m, 8),
          quantity: restockQty, unit_price: a.price, total_amount: a.price * restockQty,
          supplier: "Demo Supplier Co.", invoice_no: `PO-${1000 + invSeq++}`,
          payment_method: "cash", notes: "Demo periodic restock",
        });
      }
    } else {
      purchases.push({
        office_id: officeId, asset_id: A[a.code].id,
        purchase_date: dateAt(0, 5),
        quantity: a.qty, unit_price: a.price, total_amount: a.price * a.qty,
        supplier: "Demo Supplier Co.", invoice_no: `PO-${1000 + invSeq++}`,
        payment_method: "cash", notes: "Demo purchase",
      });
    }
  }
  if (purchases.length) {
    const { error } = await admin.from("asset_purchases").insert(purchases);
    if (error) throw new Error(`asset_purchases: ${error.message}`);
  }

  // 5) Installations — for fixed (serial) assets, install around purchase date
  const installs = assetSpec
    .filter((a) => a.tracking === "serial" && !a.retire)
    .map((a) => ({
      office_id: officeId, asset_id: A[a.code].id, location_id: null,
      location_name: "Pump House #1", install_date: dateAt(Math.max(0, startMonth - 1), 10),
      condition_status: "good", remarks: "Demo installation",
    }));
  if (installs.length) await admin.from("asset_installations").insert(installs);

  // 6) Movements — monthly small movements for consumables
  const movements: any[] = [];
  if (monthsBack > 1) {
    for (const a of assetSpec.filter((x) => x.tracking === "quantity")) {
      for (let m = monthsBack - 1; m >= 0; m--) {
        if (m % 2 !== 0) continue;
        movements.push({
          office_id: officeId, asset_id: A[a.code].id, movement_date: dateAt(m, 15),
          from_location_id: null, to_location_id: null,
          quantity: Math.max(5, Math.floor(a.qty / 10)),
          remarks: `Demo site delivery (${a.name_en})`,
          approval_status: "approved", applied: true,
        });
      }
    }
  }
  if (movements.length) await admin.from("asset_movements").insert(movements);

  // 7) Maintenance — quarterly for each fixed asset
  const maint: any[] = [];
  for (const a of assetSpec.filter((x) => x.type === "fixed_asset" && !x.retire)) {
    const every = monthsBack >= 6 ? 3 : Math.max(1, Math.floor(monthsBack / 2));
    for (let m = monthsBack - 1; m >= 0; m -= every) {
      maint.push({
        office_id: officeId, asset_id: A[a.code].id,
        maintenance_date: dateAt(m, 20), vendor: "Demo Service Center",
        cost: 800 + (m * 50), downtime_days: 1, status: "completed",
        remarks: `Routine maintenance — ${a.name_en}`,
      });
    }
  }
  if (maint.length) await admin.from("asset_maintenance_logs").insert(maint);

  // 8) Depreciation settings + monthly schedule for fixed assets
  const depSettings = assetSpec
    .filter((a) => a.type === "fixed_asset" && a.life > 0)
    .map((a) => ({
      office_id: officeId, asset_id: A[a.code].id,
      method: "straight_line", useful_life_months: a.life,
      salvage_value: a.salvage, wdv_rate_pct: 0,
      start_on: dateAt(Math.max(0, startMonth - 1), 1),
      expense_account_code: "5410", accum_account_code: "1610", is_active: true,
    }));
  if (depSettings.length) {
    const { error } = await admin.from("asset_depreciation_settings").insert(depSettings);
    if (error) throw new Error(`asset_depreciation_settings: ${error.message}`);
  }

  // Generate monthly schedule rows for last `monthsBack` months (pending — no journal posted)
  const schedule: any[] = [];
  for (const a of assetSpec.filter((x) => x.type === "fixed_asset" && x.life > 0)) {
    const monthly = +(((a.price - a.salvage) / a.life)).toFixed(2);
    let opening = a.price;
    let accum = 0;
    const months = Math.min(monthsBack, a.life);
    for (let m = months - 1; m >= 0; m--) {
      accum = +(accum + monthly).toFixed(2);
      const closing = +(opening - monthly).toFixed(2);
      schedule.push({
        office_id: officeId, asset_id: A[a.code].id,
        period_month: monthFirst(m),
        opening_book_value: opening,
        depreciation_amount: monthly,
        accumulated_depreciation: accum,
        closing_book_value: closing,
        status: "pending",
      });
      opening = closing;
    }
  }
  if (schedule.length) {
    const { error } = await admin.from("asset_depreciation_schedule").insert(schedule);
    if (error) throw new Error(`asset_depreciation_schedule: ${error.message}`);
  }

  // 9) Disposal — retire one old asset at end of window (sale below book value → loss)
  const disposals: any[] = [];
  for (const a of assetSpec.filter((x) => x.retire)) {
    const monthsDep = Math.min(monthsBack, a.life);
    const accumDep = +(((a.price - a.salvage) / a.life) * monthsDep).toFixed(2);
    const bookValue = Math.max(a.salvage, +(a.price - accumDep).toFixed(2));
    const saleAmount = Math.max(500, Math.floor(bookValue * 0.4));
    disposals.push({
      office_id: officeId, asset_id: A[a.code].id,
      disposal_date: dateAt(0, 25), method: "scrap_sale",
      sale_amount: saleAmount, book_value: bookValue,
      gain_loss: +(saleAmount - bookValue).toFixed(2),
      remarks: "Demo: old unit scrapped",
    });
  }
  if (disposals.length) {
    const { error } = await admin.from("asset_disposals").insert(disposals);
    if (error) throw new Error(`asset_disposals: ${error.message}`);
  }

  // 10) Maintenance Schedules — recurring preventive maintenance per fixed asset
  const schedules = assetSpec
    .filter((a) => a.type === "fixed_asset" && !a.retire)
    .map((a, i) => ({
      office_id: officeId, asset_id: A[a.code].id,
      title: `Quarterly service — ${a.name_en}`,
      frequency_days: 90,
      next_due_at: dateAt(-1, 10 + i), // due in ~1 month
      vendor: "Demo Service Center",
      notes: "Routine preventive maintenance",
      active: true,
    }));
  if (schedules.length) await admin.from("asset_maintenance_schedules").insert(schedules);

  // 11) Alerts — mix of stock/maintenance/depreciation, open + resolved
  const alerts: any[] = [];
  // Low-stock alert for consumable
  alerts.push({
    office_id: officeId, asset_id: A["SPR-IMP-01"].id, alert_type: "low_stock",
    severity: "warning", message_en: "Stock for Pump Impeller below minimum",
    message_bn: "পাম্প ইমপেলারের স্টক নিম্নসীমার নিচে", status: "open",
  });
  alerts.push({
    office_id: officeId, asset_id: A["SPR-BRG-01"].id, alert_type: "low_stock",
    severity: "info", message_en: "Motor Bearing Set running low",
    message_bn: "মোটর বিয়ারিং স্টক কমছে", status: "resolved",
    resolved_at: dateAt(1, 12) + "T10:00:00Z",
  });
  // Maintenance due alert
  alerts.push({
    office_id: officeId, asset_id: A["PMP-001"].id, alert_type: "maintenance_due",
    severity: "warning", message_en: "Quarterly service due for Centrifugal Pump 5HP",
    message_bn: "সেন্ট্রিফিউগাল পাম্প ৫HP-এর ত্রৈমাসিক সার্ভিস বাকি", status: "open",
  });
  // Depreciation alert
  alerts.push({
    office_id: officeId, asset_id: A["MOT-001"].id, alert_type: "high_depreciation",
    severity: "info", message_en: "Motor 5HP nearing 60% depreciation",
    message_bn: "মোটর ৫HP প্রায় ৬০% অবচয় ছুঁয়েছে", status: "acknowledged",
    acknowledged_at: dateAt(0, 5) + "T08:00:00Z",
  });
  await admin.from("asset_alerts").insert(alerts);

  // 12) Damage reports — 2 reports (1 open, 1 closed)
  const damages = [
    {
      office_id: officeId, asset_id: A["PMP-002"].id,
      report_date: dateAt(Math.min(monthsBack - 1, 2), 18),
      severity: "minor", status: "open",
      remarks: "Seal leakage observed during routine check",
    },
    {
      office_id: officeId, asset_id: A["MOT-002"].id,
      report_date: dateAt(Math.min(monthsBack - 1, 4), 12),
      severity: "major", status: "resolved",
      remarks: "Winding burnt; replaced/disposed",
    },
  ];
  await admin.from("asset_damage_reports").insert(damages);

  // 13) Scan logs — simulate QR/barcode scans across the window
  const scans: any[] = [];
  const scanSpread = Math.max(3, monthsBack);
  for (let m = 0; m < scanSpread; m++) {
    for (const a of assetSpec.slice(0, 4)) {
      scans.push({
        office_id: officeId, asset_id: A[a.code].id, asset_code: a.code,
        scanned_text: A[a.code].id, source: m % 2 === 0 ? "camera" : "manual",
        success: true, scanned_at: dateAt(m, 14) + "T09:30:00Z",
      });
    }
  }
  // 2 failed scans
  scans.push({
    office_id: officeId, asset_id: null, asset_code: null,
    scanned_text: "UNKNOWN-XYZ-001", source: "camera",
    success: false, error_message: "Asset not found",
    scanned_at: dateAt(0, 20) + "T11:00:00Z",
  });
  if (scans.length) await admin.from("asset_scan_logs").insert(scans);

  // 14) Audit logs — record key actions
  const auditRows: any[] = [];
  for (const a of assetSpec) {
    auditRows.push({
      office_id: officeId, asset_id: A[a.code].id,
      entity: "asset", entity_id: A[a.code].id, action_type: "create",
      remarks: `Demo seed: ${a.name_en} registered`,
    });
  }
  auditRows.push({
    office_id: officeId, asset_id: A["MOT-002"].id, entity: "asset_disposal",
    action_type: "create", remarks: "Demo: disposal recorded",
  });
  await admin.from("asset_audit_logs").insert(auditRows);

  return {
    categories: catSpec.length,
    assets: assetSpec.length,
    purchases: purchases.length,
    movements: movements.length,
    maintenance: maint.length,
    schedules: schedules.length,
    depreciation: schedule.length,
    disposals: disposals.length,
    alerts: alerts.length,
    damages: damages.length,
    scans: scans.length,
    audits: auditRows.length,
    skipped: false,
  };
}

// ---- Land History: one row per land per fiscal year covered ----
async function seedLandHistory(admin: any, officeId: string, farmers: any[], lands: any[], monthsBack: number): Promise<number> {
  if (!lands.length) return 0;
  const today = new Date();
  const currentFY = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  const yearsBack = Math.max(1, Math.ceil(monthsBack / 12));
  const cropsByMonth = ["Boro", "Aman", "Aus"];
  const rows: any[] = [];
  for (let y = 0; y < yearsBack; y++) {
    const fy = currentFY - y;
    for (let i = 0; i < lands.length; i++) {
      const l = lands[i];
      const owner = farmers.find((f) => f.id === l.farmer_id);
      if (!owner) continue;
      const useBorga = i % 5 === 0;
      const cultivator = useBorga ? farmers[(i + 3) % farmers.length] : null;
      rows.push({
        office_id: officeId, land_id: l.id, farmer_id: owner.id,
        fiscal_year: fy,
        season: pick(cropsByMonth, i),
        mouza: l.mouza_name ?? null,
        dag_no: l.dag_no ?? null,
        land_size: l.size ?? l.land_size ?? 1,
        owner_type: useBorga ? "borga" : "own",
        field_type: i % 2 === 0 ? "irrigated" : "rainfed",
        cultivator_farmer_id: cultivator?.id ?? null,
        crop: pick(cropsByMonth, i + y),
        yield_amount: 800 + (i % 7) * 50,
        yield_unit: "kg",
        remarks: `Demo land history ${fy}`,
      });
    }
  }
  if (!rows.length) return 0;
  // Insert in chunks of 500 to avoid payload limits
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await admin.from("land_history").insert(chunk);
    if (error) throw new Error(`land_history: ${error.message}`);
  }
  return rows.length;
}

// ---- Voter Audit (Cancel/Reactivate History) ----
async function seedVoterAuditLogs(admin: any, officeId: string, farmers: any[]): Promise<number> {
  const voters = farmers.filter((f: any) => f.is_voter);
  if (voters.length < 3) return 0;
  const rows: any[] = [];
  // pick a few voters: cancel one, then reactivate; cancel another permanently
  const today = new Date();
  const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000).toISOString();
  for (let i = 0; i < Math.min(5, voters.length); i++) {
    const v = voters[i];
    if (i % 2 === 0) {
      rows.push({
        farmer_id: v.id, office_id: officeId, account_number: v.account_number,
        voter_number_old: v.voter_number, voter_number_new: null,
        is_voter_old: true, is_voter_new: false, action: "cancel",
        note: "Demo: ভোটার বাতিল (পরীক্ষামূলক)", created_at: daysAgo(60 - i * 5),
      });
      rows.push({
        farmer_id: v.id, office_id: officeId, account_number: v.account_number,
        voter_number_old: null, voter_number_new: v.voter_number,
        is_voter_old: false, is_voter_new: true, action: "reactivate",
        note: "Demo: ভোটার পুনঃসক্রিয় করা হলো", created_at: daysAgo(40 - i * 5),
      });
    } else {
      rows.push({
        farmer_id: v.id, office_id: officeId, account_number: v.account_number,
        voter_number_old: v.voter_number, voter_number_new: v.voter_number,
        is_voter_old: true, is_voter_new: true, action: "update",
        note: "Demo: তথ্য হালনাগাদ", created_at: daysAgo(20 + i),
      });
    }
  }
  const { error } = await admin.from("voter_audit_logs").insert(rows);
  if (error) throw new Error(`voter_audit_logs: ${error.message}`);
  return rows.length;
}

// ---- Public Payment Intents (পাবলিক পেমেন্ট অনুরোধ) ----
async function seedPublicPaymentIntents(admin: any, officeId: string, farmers: any[]): Promise<number> {
  if (!farmers.length) return 0;
  const today = new Date();
  const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000).toISOString();
  const sample = farmers.slice(0, Math.min(8, farmers.length));
  const rows = sample.map((f, i) => ({
    office_id: officeId,
    farmer_code: f.farmer_code,
    phone: `017${String(10000000 + i * 1234).slice(0, 8)}`,
    amount: 500 + (i % 5) * 250,
    allocation_hint: i % 3 === 0 ? "irrigation" : i % 3 === 1 ? "loan" : "savings",
    note: `Demo public payment request #${i + 1}`,
    status: i < 3 ? "pending" : i < 6 ? "processed" : "rejected",
    created_at: daysAgo(30 - i * 3),
    processed_at: i >= 3 && i < 6 ? daysAgo(28 - i * 3) : null,
  }));
  const { error } = await admin.from("public_payment_intents").insert(rows);
  if (error) throw new Error(`public_payment_intents: ${error.message}`);
  return rows.length;
}

// ---- Land Transfers (inheritance / sale / borga / split) ----
// Mirrors LandTransferDialog: snapshots source info, creates recipient land rows,
// and archives/decrements the source land so transfers show up in BOTH profiles.
async function seedLandTransfers(admin: any, officeId: string, lands: any[], farmers: any[]): Promise<number> {
  const voters = farmers.filter((f: any) => f.is_voter);
  if (!lands.length || voters.length < 2) return 0;
  // inheritance = উত্তরাধিকার, sale = বিক্রি, borga_transfer = বর্গা, split = সন্তানদের ভাগ
  const types = ["inheritance", "sale", "borga_transfer", "split"];
  const today = new Date();
  const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
  // ~12% of lands have at least one historical transfer
  const sample = lands.filter((_, i) => i % 8 === 0).slice(0, 12);
  let count = 0;
  for (let i = 0; i < sample.length; i++) {
    const l = sample[i];
    const ttype = types[i % types.length];
    const isBorga = ttype === "borga_transfer";
    const area = Number(l.land_size ?? l.size ?? 1);

    // Source owner snapshot
    const owner = farmers.find((f: any) => f.id === l.farmer_id);
    const { data: tr, error: trErr } = await admin.from("land_transfers").insert({
      source_land_id: l.id,
      source_farmer_id: l.farmer_id,
      transfer_type: ttype,
      remark: `Demo ${ttype} transfer #${i + 1}`,
      office_id: officeId,
      transferred_at: daysAgo(30 + i * 7),
      source_dag_no: l.dag_no ?? null,
      source_mouza: l.mouza_id ?? null,
      source_land_size: area,
      source_owner_name: owner?.name_bn || owner?.name_en || null,
      source_owner_code: owner?.member_no ?? owner?.farmer_code ?? null,
    }).select("id").single();
    if (trErr || !tr) continue;

    // 1–2 recipients (split distributes to 2 children)
    const recipientCount = ttype === "split" ? 2 : 1;
    const each = +(area / recipientCount).toFixed(3);
    const picked: any[] = [];
    for (let r = 0; r < recipientCount; r++) {
      const recipient = voters.find((v: any) => v.id !== l.farmer_id && !picked.some((x) => x.id === v.id));
      if (recipient) picked.push(recipient);
    }
    if (!picked.length) continue;

    for (const recipient of picked) {
      const eachArea = Math.max(0.001, each);
      // Create the recipient's land row (cloned from source)
      const { data: nl, error: nlErr } = await admin.from("lands").insert({
        farmer_id: recipient.id,
        land_size: eachArea,
        mouza_id: l.mouza_id ?? null,
        dag_no: l.dag_no ?? null,
        land_type_id: l.land_type_id ?? null,
        field_type: l.field_type ?? null,
        owner_type: isBorga ? "borgadar" : "owner",
        owner_farmer_id: isBorga ? l.farmer_id : null,
        office_id: officeId,
      }).select("id").single();
      if (nlErr || !nl) continue;
      const { error: rErr } = await admin.from("land_transfer_recipients").insert({
        transfer_id: tr.id,
        recipient_farmer_id: recipient.id,
        new_land_id: nl.id,
        area_decimal: eachArea,
      });
      if (!rErr) count += 1;
    }

    // Adjust the source land: borga keeps remaining size; others archive fully.
    const givenSum = +(each * picked.length).toFixed(3);
    if (isBorga) {
      const remaining = +(area - givenSum).toFixed(3);
      if (remaining > 0.0001) {
        await admin.from("lands").update({ land_size: remaining }).eq("id", l.id);
      } else {
        await admin.from("lands").update({ deleted_at: new Date().toISOString() }).eq("id", l.id);
      }
    } else {
      await admin.from("lands").update({ deleted_at: new Date().toISOString() }).eq("id", l.id);
    }
    count += 1;
  }
  return count;
}

// ---- Loan Guarantors (1–2 per approved loan) ----
async function seedLoanGuarantors(admin: any, officeId: string): Promise<number> {
  const { data: loans } = await admin.from("loans").select("id, farmer_id, office_id, status").eq("office_id", officeId).eq("status", "approved").limit(500);
  if (!loans?.length) return 0;
  const { data: pool } = await admin.from("farmers").select("id, name_en, name_bn, father_name_en, village, mobile, nid").eq("office_id", officeId).limit(200);
  const farmers = pool ?? [];
  if (!farmers.length) return 0;
  const rows: any[] = [];
  for (let i = 0; i < loans.length; i++) {
    const loan = loans[i];
    const want = i % 4 === 0 ? 2 : 1;
    const used = new Set<string>([loan.farmer_id]);
    for (let g = 0; g < want; g++) {
      const cand = farmers[(i + g * 7 + 3) % farmers.length];
      if (!cand || used.has(cand.id)) continue;
      used.add(cand.id);
      rows.push({
        loan_id: loan.id,
        farmer_id: cand.id,
        name: cand.name_bn || cand.name_en || "Demo Guarantor",
        father_name: cand.father_name_en ?? null,
        village: cand.village ?? null,
        mobile: cand.mobile ?? null,
        nid: cand.nid ?? null,
        office_id: officeId,
      });
    }
  }
  if (!rows.length) return 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("loan_guarantors").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`loan_guarantors: ${error.message}`);
  }
  return rows.length;
}

// ---- Land Change Log (basic edit/transfer events) ----
async function seedLandChangeLog(admin: any, officeId: string, lands: any[], farmers: any[]): Promise<number> {
  if (!lands.length) return 0;
  const today = new Date();
  const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000).toISOString();
  const rows = lands.filter((_, i) => i % 6 === 0).slice(0, 15).map((l, i) => ({
    land_id: l.id,
    farmer_id: l.farmer_id,
    office_id: officeId,
    change_type: i % 3 === 0 ? "update" : i % 3 === 1 ? "transfer" : "field_type_change",
    old_values: { land_size: Number(l.land_size ?? 1) - 0.1, field_type: "low_land" },
    new_values: { land_size: Number(l.land_size ?? 1), field_type: "medium_land" },
    remarks: `Demo land change event #${i + 1}`,
    created_at: daysAgo(20 + i * 3),
  }));
  if (!rows.length) return 0;
  const { error } = await admin.from("land_change_log").insert(rows);
  if (error) throw new Error(`land_change_log: ${error.message}`);
  return rows.length;
}

// ---- Savings Yearly Opening Balances (previous year carry-over) ----
async function seedSavingsYearlyOpening(admin: any, officeId: string, farmers: any[]): Promise<number> {
  const voters = farmers.filter((f: any) => f.is_voter);
  if (!voters.length) return 0;
  const lastYear = new Date().getFullYear() - 1;
  const targets = voters.slice(0, Math.ceil(voters.length * 0.4));
  const rows = targets.map((f, i) => ({
    farmer_id: f.id,
    year: lastYear,
    opening_balance: 500 + (i % 10) * 250,
    office_id: officeId,
  }));
  if (!rows.length) return 0;
  const { error } = await admin.from("savings_yearly_opening").insert(rows);
  if (error) throw new Error(`savings_yearly_opening: ${error.message}`);
  return rows.length;
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
    { code: "1600", name: "Fixed Assets", type: "asset", is_system: false },
    { code: "1610", name: "Accumulated Depreciation", type: "asset", is_system: false },
    { code: "2010", name: "Savings Payable", type: "liability", is_system: true },
    { code: "3020", name: "Share Capital", type: "equity", is_system: true },
    { code: "4010", name: "Irrigation Income", type: "income", is_system: true },
    { code: "4020", name: "Loan Interest Income", type: "income", is_system: false },
    { code: "5010", name: "Maintenance", type: "expense", is_system: true },
    { code: "5020", name: "Electricity", type: "expense", is_system: true },
    { code: "5030", name: "Salary", type: "expense", is_system: true },
    { code: "5040", name: "Repair", type: "expense", is_system: true },
    { code: "5090", name: "Other Expenses", type: "expense", is_system: true },
    { code: "5410", name: "Depreciation Expense", type: "expense", is_system: false },
  ];
  const { error } = await admin.from("accounts").upsert(accts, { onConflict: "code" });
  if (error) throw error;
}

async function seedSettings(admin: any, officeId?: string) {
  // Self-contained demo logo + editor signature (inline SVG data URIs) so a
  // freshly imported demo prints a fully-populated receipt (logo, QR, signature).
  const demoLogo = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><circle cx='60' cy='60' r='56' fill='#0f766e'/><text x='60' y='72' font-size='44' fill='#fff' text-anchor='middle' font-family='sans-serif'>সে</text></svg>`,
  );
  const demoSignature = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='60'><path d='M5 45 C30 5, 50 55, 75 25 S120 5, 150 40' stroke='#1d4ed8' stroke-width='3' fill='none'/><text x='100' y='58' font-size='12' fill='#555' text-anchor='middle' font-family='sans-serif'>সম্পাদক</text></svg>`,
  );
  const { error: csErr } = await admin.from("company_settings").upsert({
    id: 1, company_name: "Smart Irrigation Cooperative", company_name_bn: "স্মার্ট সেচ সমবায়",
    address: "Baliadanga, Rangpur", mobile: "01700000000", email: "demo@example.com",
    registration_no: "COOP-2018-0451",
    logo_url: demoLogo, editor_signature_url: demoSignature,
    default_loan_interest: 12,
    penalty_type: "percent", penalty_value: 2, penalty_grace_days: 30,
    fiscal_year_start_month: 7,
    loan_receipt_no_format: "LOAN-{YYYYMMDD}-{TAIL}",
    loan_receipt_header_en: "Smart Irrigation Cooperative — Loan Receipt",
    loan_receipt_header_bn: "স্মার্ট সেচ সমবায় — ঋণ রসিদ",
    loan_receipt_footer_en: "Thank you for your timely payment.",
    loan_receipt_footer_bn: "সময়মত পরিশোধের জন্য ধন্যবাদ।",
    pdf_footer_text: "If found, please return to the issuing office.",
    pdf_footer_show_address: true, pdf_footer_show_contact: true,
  });
  if (csErr) console.warn("[demo-reset] company_settings:", csErr.message);

  await admin.from("card_settings").upsert({ id: 1 });
  // SMS settings — disabled by default for demo, but template fields populated
  await admin.from("sms_settings").upsert({
    id: 1, enabled: false,
    send_on_irrigation_payment: true, send_on_loan_payment: true,
    send_on_loan_approved: true,
    send_on_savings_deposit: true, send_on_savings_withdraw: true,
  } as any).then(() => {}).catch(() => {});
  // Per-office SMS toggle
  if (officeId) {
    await admin.from("sms_office_settings").upsert(
      { office_id: officeId, enabled: false, sender_id: "DEMO" },
      { onConflict: "office_id" }
    ).then(() => {}).catch(() => {});
  }
  // Default receipt settings (best-effort; ignore if shape differs)
  await admin.from("receipt_settings").upsert({ id: 1 } as any).then(() => {}).catch(() => {});
  // QR rotation defaults
  await admin.from("qr_rotation_settings").upsert(
    { id: 1, enabled: false, interval_days: 90, grace_hours: 24 }
  ).then(() => {}).catch(() => {});
}

async function seedAccountingPeriod(admin: any, officeId: string) {
  // Open period for current fiscal year (July → June)
  const today = new Date();
  const fyStartYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  const period_start = `${fyStartYear}-07-01`;
  const period_end = `${fyStartYear + 1}-06-30`;
  await admin.from("accounting_periods").upsert(
    { office_id: officeId, period_start, period_end, status: "open" },
    { onConflict: "period_start,period_end,office_id" }
  ).then(() => {}).catch(() => {});
}

async function seedDuePromises(admin: any, officeId: string, farmers: any[]) {
  const voters = farmers.filter((f: any) => f.is_voter).slice(0, 5);
  if (!voters.length) return 0;
  const rows = voters.map((f: any, i: number) => ({
    farmer_id: f.id, office_id: officeId,
    previous_due_amount: 500 + i * 100,
    promise_date: new Date(Date.now() + (7 + i * 3) * 86400000).toISOString().slice(0, 10),
    status: i === 0 ? "fulfilled" : i === 4 ? "overdue" : "pending",
    remarks: "Demo due promise",
  }));
  const { error } = await admin.from("irrigation_due_promises").insert(rows);
  if (error) return 0;
  return rows.length;
}

async function findOrInsert(admin: any, table: string, match: Record<string, any>, insertExtra: Record<string, any> = {}) {
  let q: any = admin.from(table).select("id");
  for (const [k, v] of Object.entries(match)) q = v == null ? q.is(k, null) : q.eq(k, v);
  const { data: found } = await q.maybeSingle();
  if (found?.id) return found.id as string;
  const { data, error } = await admin.from(table).insert({ ...match, ...insertExtra }).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}

async function seedLocations(admin: any): Promise<LocPick[]> {
  const out: LocPick[] = [];
  const divId = await findOrInsert(admin, "divisions",
    { name: LOCATION_TREE.division.name },
    { name_bn: LOCATION_TREE.division.name_bn, code: LOCATION_TREE.division.code });
  for (const d of LOCATION_TREE.districts) {
    const distId = await findOrInsert(admin, "districts",
      { name: d.name, division_id: divId },
      { name_bn: d.name_bn, code: d.code });
    for (const u of d.upazilas) {
      const upaId = await findOrInsert(admin, "upazilas",
        { name: u.name, district_id: distId }, { name_bn: u.name_bn });
      for (const m of u.mouzas) {
        const mouzaId = await findOrInsert(admin, "mouzas",
          { name: m.name, upazila_id: upaId }, { name_bn: m.name_bn });
        out.push({ division_id: divId, district_id: distId, upazila_id: upaId, mouza_id: mouzaId, mouza_name: m.name });
      }
    }
  }
  return out;
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
  c["land_types"] = 3; c["irrigation_season_types"] = 3;
  if (modules.includes("settings")) c["company/card/sms/receipt settings"] = 4;
  if (modules.includes("accounting")) c["accounts"] = 12;
  if (modules.includes("farmers")) { c["farmers"] = size; c["lands"] = size; c["patwaris"] = Math.max(4, Math.ceil(size / 12)); c["land_relations"] = Math.ceil(size / 7); }
  if (modules.includes("irrigation")) { c["seasons"] = 1; c["irrigation_charge_settings"] = 1; c["irrigation_season_rates"] = 3; c["irrigation_charges"] = size; c["irrigation_invoices"] = size; }
  if (modules.includes("loans")) { const n = Math.ceil(size * 0.4); c["loan_plans"] = 3; c["loan_delay_fee_settings"] = 1; c["loans"] = n; c["loan_installments"] = n * 12; c["loan_payments"] = n * 3; c["loan_guarantors"] = n; }
  if (modules.includes("savings")) { const n = Math.ceil(size * 0.6); c["savings_plans"] = 3; c["savings_transactions"] = n + Math.ceil(n / 4); c["shares"] = Math.ceil(size * 0.5); c["farmer_savings_plans"] = Math.ceil(n * 0.5); c["savings_yearly_opening"] = Math.ceil(size * 0.5); }
  if (modules.includes("accounting")) c["accounting_periods"] = 1;
  if (modules.includes("irrigation") && modules.includes("farmers")) c["irrigation_due_promises"] = 5;
  if (modules.includes("expenses")) c["expenses"] = 3;
  if (modules.includes("bank")) { c["bank_accounts"] = 3; c["bank_transactions"] = 6; }
  if (modules.includes("cashbook")) { c["office_incomes"] = 4; c["receipts"] = 15; c["cashbook_submissions"] = 1; c["hand_cash_submissions"] = 1; }
  if (modules.includes("assets")) {
    c["asset_categories"] = 4; c["assets"] = 8; c["asset_stocks"] = 8;
    c["asset_purchases"] = 8; c["asset_installations"] = 3;
    c["asset_movements"] = 12; c["asset_maintenance_logs"] = 12;
    c["asset_maintenance_schedules"] = 3;
    c["asset_depreciation_settings"] = 4; c["asset_depreciation_schedule"] = 48;
    c["asset_disposals"] = 1;
    c["asset_alerts"] = 4; c["asset_damage_reports"] = 2;
    c["asset_scan_logs"] = 12; c["asset_audit_logs"] = 9;
  }
  if (modules.includes("irrigation")) { c["irrigation_invoice_payments"] = Math.ceil(size / 2); }
  if (modules.includes("farmers")) {
    c["farmer_notes"] = 10;
    c["land_history"] = size;
    c["land_transfers"] = Math.ceil(size / 5);
    c["land_change_log"] = Math.ceil(size / 5);
    c["voter_audit_logs"] = 5;
    c["public_payment_intents"] = 8;
  }
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

// ---- Post-import row-count + page mapping verification ----
// Mirrors src/lib/demoPresets.ts MODULE_VERIFY (Deno isolation).
const MODULE_VERIFY: Record<string, { table: string; page: string; page_label: string; required: boolean }[]> = {
  locations: [
    { table: "divisions", page: "/locations", page_label: "Locations", required: true },
    { table: "districts", page: "/locations", page_label: "Locations", required: true },
    { table: "upazilas",  page: "/locations", page_label: "Locations", required: true },
    { table: "mouzas",    page: "/locations", page_label: "Locations", required: true },
  ],
  settings: [
    { table: "company_settings", page: "/settings",      page_label: "Settings",      required: true },
    { table: "card_settings",    page: "/card-designer", page_label: "Card Designer", required: false },
  ],
  accounting: [
    { table: "accounts",           page: "/accounts",     page_label: "Chart of Accounts", required: true },
    { table: "accounting_periods", page: "/period-close", page_label: "Period Close",      required: true },
  ],
  farmers: [
    { table: "farmers",                page: "/farmers",         page_label: "Farmers",          required: true },
    { table: "lands",                  page: "/farmers",         page_label: "Farmers (Lands)",  required: true },
    { table: "patwaris",               page: "/admin/patwaris",  page_label: "Patwaris",         required: false },
    { table: "land_relations",         page: "/farmers",         page_label: "Farmers (Borga)",  required: false },
    { table: "land_history",           page: "/land-history",    page_label: "ভূমির ইতিহাস (Land History)", required: false },
    { table: "land_transfers",         page: "/farmers",         page_label: "জমি হস্তান্তর (Land Transfers)", required: false },
    { table: "land_transfer_recipients", page: "/farmers",       page_label: "জমি হস্তান্তর প্রাপক (Transfer Recipients)", required: false },
    { table: "land_change_log",        page: "/farmers",         page_label: "জমি পরিবর্তন লগ (Land Change Log)", required: false },
    { table: "farmer_notes",           page: "/farmers",         page_label: "ফার্মার নোট (Farmer Notes)", required: false },
    { table: "voter_audit_logs",       page: "/voter-history",   page_label: "Voter Cancel/Reactivate History", required: false },
    { table: "public_payment_intents", page: "/admin/public-payments", page_label: "পাবলিক পেমেন্ট অনুরোধ", required: false },
  ],
  irrigation: [
    { table: "irrigation_charge_settings", page: "/irrigation-rates",    page_label: "Irrigation Rates",    required: true },
    { table: "irrigation_season_rates",    page: "/irrigation-rates",    page_label: "Irrigation Rates",    required: true },
    { table: "irrigation_invoices",        page: "/irrigation-invoices", page_label: "Irrigation Invoices", required: true },
    { table: "irrigation_charges",         page: "/irrigation-invoices", page_label: "Irrigation Charges",  required: false },
    { table: "irrigation_invoice_payments",page: "/irrigation-invoices", page_label: "Irrigation Payments", required: false },
    { table: "irrigation_due_promises",    page: "/irrigation-invoices", page_label: "Due Promises",        required: false },
    { table: "seasons",                    page: "/seasons",             page_label: "Seasons",             required: true },
  ],
  loans: [
    { table: "loan_plans",              page: "/loan-plans",                 page_label: "Loan Plans",           required: true },
    { table: "loan_delay_fee_settings", page: "/admin/loan-delay-settings",  page_label: "Loan Installment Penalty Settings", required: true },
    { table: "loans",                   page: "/loans",                      page_label: "Loans",                required: true },
    { table: "loan_installments",       page: "/loans",                      page_label: "Loans (Installments)", required: true },
    { table: "loan_payments",           page: "/loans",                      page_label: "Loans (Payments)",     required: false },
    { table: "loan_guarantors",         page: "/loans",                      page_label: "ঋণের জামিনদার (Guarantors)", required: false },
  ],
  savings: [
    { table: "savings_plans",         page: "/savings",          page_label: "Savings",          required: true },
    { table: "savings_transactions",  page: "/savings",          page_label: "Savings (Tx)",     required: true },
    { table: "shares",                page: "/share-collection", page_label: "Share Collection", required: false },
    { table: "farmer_savings_plans",  page: "/savings",          page_label: "Savings (Plans)",  required: false },
    { table: "savings_yearly_opening",page: "/savings",          page_label: "সঞ্চয় ওপেনিং ব্যালেন্স", required: false },
  ],
  expenses: [
    { table: "expenses", page: "/payments", page_label: "Payments / Expenses", required: true },
  ],
  bank: [
    { table: "bank_accounts",     page: "/banking", page_label: "Bank Accounts",     required: true },
    { table: "bank_transactions", page: "/banking", page_label: "Bank Transactions", required: true },
  ],
  cashbook: [
    { table: "receipts",               page: "/cashbook",  page_label: "Cash Book (Receipts)", required: true },
    { table: "office_incomes",         page: "/cashbook",  page_label: "Office Incomes",       required: true },
    { table: "cashbook_submissions",   page: "/cashbook",  page_label: "Cash Book Submissions", required: false },
    { table: "hand_cash_submissions",  page: "/hand-cash", page_label: "Hand Cash",            required: false },
  ],
  assets: [
    { table: "asset_categories",            page: "/assets/categories",    page_label: "Asset Categories",      required: true },
    { table: "assets",                      page: "/assets",               page_label: "Asset Registry",        required: true },
    { table: "asset_stocks",                page: "/assets/stocks",        page_label: "Asset Stock",           required: true },
    { table: "asset_purchases",             page: "/assets/purchases",     page_label: "Asset Purchases",       required: true },
    { table: "asset_installations",         page: "/assets/installations", page_label: "Asset Installations",   required: false },
    { table: "asset_movements",             page: "/assets/movements",     page_label: "Asset Movements",       required: false },
    { table: "asset_maintenance_logs",      page: "/assets/maintenance",   page_label: "Asset Maintenance",     required: false },
    { table: "asset_maintenance_schedules", page: "/assets/maintenance",   page_label: "Maintenance Schedules", required: false },
    { table: "asset_depreciation_settings", page: "/assets/depreciation",  page_label: "Depreciation Setup",    required: false },
    { table: "asset_depreciation_schedule", page: "/assets/depreciation",  page_label: "Depreciation Schedule", required: false },
    { table: "asset_disposals",             page: "/assets/disposals",     page_label: "Asset Disposals",       required: false },
    { table: "asset_alerts",                page: "/assets/alerts",        page_label: "Asset Alerts",          required: false },
    { table: "asset_damage_reports",        page: "/assets",               page_label: "Damage Reports",        required: false },
    { table: "asset_scan_logs",             page: "/assets/scan-history",  page_label: "Scan History",          required: false },
    { table: "asset_audit_logs",            page: "/assets",               page_label: "Asset Audit Logs",      required: false },
  ],
};

async function verifyRowCounts(admin: any, modules: string[]) {
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const m of modules) {
    const entries = MODULE_VERIFY[m];
    if (!entries) continue;
    for (const e of entries) {
      if (seen.has(e.table)) continue;
      seen.add(e.table);
      const { count, error } = await admin.from(e.table).select("*", { count: "exact", head: true });
      const actual = error ? 0 : (count ?? 0);
      const status = actual > 0 ? "ok" : (e.required ? "empty_required" : "empty_optional");
      rows.push({ module: m, ...e, actual, status });
    }
  }
  const failed = rows.filter((r) => r.status === "empty_required").length;
  const warnings = rows.filter((r) => r.status === "empty_optional").length;
  const ok = rows.filter((r) => r.status === "ok").length;
  return { rows, total: rows.length, ok, failed, warnings, allOk: failed === 0 };
}

// ---- Preset definitions (mirrors src/lib/demoPresets.ts) ----
const PRESETS: Record<string, { size: number; modules: string[]; monthsBack?: number }> = {
  small:           { size: 25,  modules: ["locations","settings","accounting","farmers","irrigation","loans","savings","expenses","bank","cashbook","assets"] },
  medium:          { size: 50,  modules: ["locations","settings","accounting","farmers","irrigation","loans","savings","expenses","bank","cashbook","assets"] },
  large:           { size: 200, modules: ["locations","settings","accounting","farmers","irrigation","loans","savings","expenses","bank","cashbook","assets"] },
  year_ops:        { size: 50,  modules: ["locations","settings","accounting","farmers","irrigation","loans","savings","expenses","bank","cashbook","assets"], monthsBack: 12 },
  loans_only:      { size: 50,  modules: ["locations","settings","accounting","farmers","loans"] },
  savings_only:    { size: 50,  modules: ["locations","settings","accounting","farmers","savings"] },
  irrigation_only: { size: 50,  modules: ["locations","settings","accounting","farmers","irrigation"] },
  recent_features: { size: 25,  modules: ["locations","settings","accounting","farmers","irrigation","loans","savings","expenses","bank","cashbook","assets"], monthsBack: 2 },
  patwari_workflow:{ size: 40,  modules: ["locations","settings","accounting","farmers","irrigation"], monthsBack: 3 },
};



async function verifyLocations(admin: any) {
  const expected = {
    divisions: 1,
    districts: LOCATION_TREE.districts.length,
    upazilas: LOCATION_TREE.districts.reduce((s, d) => s + d.upazilas.length, 0),
    mouzas: LOCATION_TREE.districts.reduce((s, d) => s + d.upazilas.reduce((u, x) => u + x.mouzas.length, 0), 0),
  };
  const actual: Record<string, number> = {};
  for (const t of ["divisions", "districts", "upazilas", "mouzas"]) {
    const { count } = await admin.from(t).select("*", { count: "exact", head: true });
    actual[t] = count ?? 0;
  }
  const missing: string[] = [];
  for (const [k, v] of Object.entries(expected)) {
    if (actual[k] < v) missing.push(`${k}: expected ≥${v}, found ${actual[k]}`);
  }
  return { ok: missing.length === 0, expected, actual, missing };
}

// ---- Streaming runner ----
async function runStream(admin: any, action: string, modules: string[], size: number, voterCfg: VoterCfg,
  ctx: { userId: string | null; userEmail: string | null; ip: string | null; ua: string | null },
  customNames?: any[], transactional: boolean = true, preset?: string, monthsBack: number = 1) {

  const encoder = new TextEncoder();
  const summary: any = { action, modules, voterCfg, transactional, preset: preset ?? null, monthsBack };


  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: any) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
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
        let locs: LocPick[] = [];
        let farmers: any[] = [];
        let landTypes: { id: string; code: string; rate: number }[] = [];
        let seasonTypes: { id: string; code: string }[] = [];
        let lands: any[] = [];
        let seasonId: string | undefined;
        const loanFarmerIds = new Set<string>();
        const savingsFarmerIds = new Set<string>();
        const sharesFarmerIds = new Set<string>();
        const fspFarmerIds = new Set<string>();

        if (action === "import" || action === "both") {
          steps.push({ key: "office", label: "অফিস তৈরি/যাচাই", fn: async () => { officeId = await ensureOffice(admin); } });
          steps.push({ key: "locations", label: "লোকেশন (বিভাগ/জেলা/উপজেলা/মৌজা) seed", fn: async () => { locs = await seedLocations(admin); summary.locations = locs.length; } });
          steps.push({ key: "land_types", label: "জমির ধরন (Land Types) seed", fn: async () => { landTypes = await seedLandTypes(admin, officeId); summary.land_types = landTypes.length; } });
          steps.push({ key: "season_types", label: "সিজন টাইপ (Boro/Aman/Aus) seed", fn: async () => { seasonTypes = await seedSeasonTypes(admin); summary.season_types = seasonTypes.length; } });
          if (modules.includes("settings")) steps.push({ key: "settings", label: "সেটিংস seed (company/card/SMS/receipt/QR)", fn: async () => { await seedSettings(admin, officeId); } });
          const needsAccounts = modules.includes("accounting") || modules.includes("loans") ||
            modules.includes("savings") || modules.includes("irrigation") ||
            modules.includes("expenses") || modules.includes("farmers");
          if (needsAccounts) steps.push({ key: "accounting", label: "চার্ট অফ একাউন্টস seed", fn: async () => { await seedAccounts(admin); } });
          if (modules.includes("farmers")) {
            steps.push({ key: "farmers", label: `${customNames?.length ? customNames.length : size} জন ফার্মার তৈরি (ভোটার অনুপাত 1/${voterCfg.voterRatio})${customNames?.length ? " — CSV থেকে" : ""}`, fn: async () => {
              farmers = await seedFarmers(admin, officeId, size, voterCfg, locs, customNames);
              summary.farmers = farmers.length;
              summary.voters = farmers.filter((f: any) => f.is_voter).length;
              summary.farmer_samples = farmers.slice(0, 10).map((f: any) => ({
                farmer_code: f.farmer_code, name_en: f.name_en, name_bn: f.name_bn, mouza_id: f.mouza_id,
              }));
            }});
            steps.push({ key: "lands", label: `${size}টি জমি তৈরি`, fn: async () => { lands = await seedLands(admin, officeId, farmers, landTypes); summary.lands = lands.length; }});
            steps.push({ key: "land_relations", label: "বর্গা সম্পর্ক (land_relations) seed", fn: async () => {
              if (lands.length) summary.land_relations = await seedLandRelations(admin, officeId, lands, farmers);
            }});
            steps.push({ key: "patwaris", label: "পাটোয়ারী seed", fn: async () => {
              const desired = preset === "patwari_workflow" ? 10 : Math.max(4, Math.ceil(size / 12));
              const p = await seedPatwaris(admin, officeId, locs, desired); summary.patwaris = p.length;
            }});
          }
          const needFarmers = modules.includes("irrigation") || modules.includes("loans") || modules.includes("savings") || modules.includes("cashbook");
          if (needFarmers && !modules.includes("farmers")) {
            steps.push({ key: "farmers:fetch", label: "বিদ্যমান ফার্মার লোড", fn: async () => {
              const { data } = await admin.from("farmers").select("id, farmer_code, is_voter, voter_number, account_number").limit(size);
              farmers = data ?? [];
            }});
          }
          if (modules.includes("irrigation")) {
            steps.push({ key: "irr_charge_settings", label: "সেচ চার্জ সেটিংস seed", fn: async () => { await seedIrrigationChargeSettings(admin, officeId); }});
            steps.push({ key: "irrigation", label: "সেচ সিজন/রেট/চার্জ seed", fn: async () => {
              if (farmers.length) seasonId = await seedIrrigation(admin, officeId, farmers, landTypes, seasonTypes);
            }});
            steps.push({ key: "irrigation_invoices", label: "সেচ ইনভয়েস + পেমেন্ট seed", fn: async () => {
              if (seasonId) summary.irrigation_invoices = await seedIrrigationInvoices(admin, officeId, seasonId, landTypes);
            }});
          }
          if (modules.includes("loans")) steps.push({ key: "loans", label: `ঋণ seed (শুধু ভোটার${monthsBack > 1 ? ` — ${monthsBack} মাস ছড়ানো` : ""})`, fn: async () => {
            if (!farmers.length) return;
            const ids = await seedLoans(admin, officeId, farmers, monthsBack);
            ids.forEach((x) => loanFarmerIds.add(x));
          }});
          if (modules.includes("savings")) steps.push({ key: "savings", label: `সঞ্চয় + শেয়ার + প্ল্যান এনরোলমেন্ট seed${monthsBack > 1 ? ` (${monthsBack} মাস মাসিক ডিপোজিট)` : ""}`, fn: async () => {
            if (!farmers.length) return;
            const out = await seedSavings(admin, officeId, farmers, monthsBack);
            out.savingsSeeded.forEach((x) => savingsFarmerIds.add(x));
            out.sharesSeeded.forEach((x) => sharesFarmerIds.add(x));
            out.fspSeeded.forEach((x) => fspFarmerIds.add(x));
          }});
          if (modules.includes("expenses")) steps.push({ key: "expenses", label: `খরচ seed${monthsBack > 1 ? ` (${monthsBack} মাস পুনরাবৃত্ত)` : ""}`, fn: async () => { summary.expenses = await seedExpenses(admin, officeId, monthsBack); }});
          if (modules.includes("accounting")) steps.push({ key: "accounting_period", label: "চলতি অর্থবছরের পিরিয়ড open", fn: async () => { await seedAccountingPeriod(admin, officeId); }});
          if (modules.includes("bank")) steps.push({ key: "bank", label: `ব্যাংক একাউন্ট ও লেনদেন seed${monthsBack > 1 ? ` (${monthsBack} মাস)` : ""}`, fn: async () => { const b = await seedBankAccounts(admin, officeId, monthsBack); summary.bank = b; }});
          if (modules.includes("cashbook")) steps.push({ key: "cashbook", label: `ক্যাশ বহি / হ্যান্ড ক্যাশ / অফিস আয় / রসিদ seed${monthsBack > 1 ? ` (${monthsBack} মাস)` : ""}`, fn: async () => { summary.cashbook = await seedCashReports(admin, officeId, farmers, monthsBack); }});
          if (modules.includes("assets")) steps.push({ key: "assets", label: `অ্যাসেট মডিউল seed${monthsBack > 1 ? ` (${monthsBack} মাস অবচয় + maintenance + movement)` : ""}`, fn: async () => { summary.assets = await seedAssets(admin, officeId, monthsBack); }});
          if (modules.includes("farmers")) steps.push({ key: "farmer_notes", label: "ফার্মার নোট seed", fn: async () => { if (farmers.length) summary.farmer_notes = await seedFarmerNotes(admin, farmers); }});
          if (modules.includes("farmers")) steps.push({ key: "land_history", label: `ভূমির ইতিহাস seed${monthsBack > 12 ? ` (${Math.ceil(monthsBack/12)} বছর)` : ""}`, fn: async () => { if (lands.length) summary.land_history = await seedLandHistory(admin, officeId, farmers, lands, monthsBack); }});
          if (modules.includes("farmers")) steps.push({ key: "voter_audit", label: "Voter Cancel/Reactivate History seed", fn: async () => { if (farmers.length) summary.voter_audit = await seedVoterAuditLogs(admin, officeId, farmers); }});
          if (modules.includes("farmers")) steps.push({ key: "public_payment_intents", label: "পাবলিক পেমেন্ট অনুরোধ seed", fn: async () => { if (farmers.length) summary.public_payment_intents = await seedPublicPaymentIntents(admin, officeId, farmers); }});
          if (modules.includes("irrigation") && modules.includes("farmers")) steps.push({ key: "due_promises", label: "পূর্ব বকেয়া কথা (due promises) seed", fn: async () => { if (farmers.length) summary.due_promises = await seedDuePromises(admin, officeId, farmers); }});
          if (modules.includes("farmers")) steps.push({ key: "land_transfers", label: "জমি হস্তান্তর (উত্তরাধিকার/বিক্রি/বর্গা/বিভক্তি) seed", fn: async () => { if (lands.length) summary.land_transfers = await seedLandTransfers(admin, officeId, lands, farmers); }});
          if (modules.includes("farmers")) steps.push({ key: "land_change_log", label: "জমি পরিবর্তন লগ seed", fn: async () => { if (lands.length) summary.land_change_log = await seedLandChangeLog(admin, officeId, lands, farmers); }});
          if (modules.includes("loans")) steps.push({ key: "loan_guarantors", label: "ঋণের জামিনদার (Guarantors) seed", fn: async () => { summary.loan_guarantors = await seedLoanGuarantors(admin, officeId); }});
          if (modules.includes("savings")) steps.push({ key: "savings_yearly_opening", label: "সঞ্চয় পূর্ববর্তী বছরের ওপেনিং ব্যালেন্স seed", fn: async () => { if (farmers.length) summary.savings_yearly_opening = await seedSavingsYearlyOpening(admin, officeId, farmers); }});

          if (modules.includes("farmers") || needFarmers) {
            steps.push({ key: "payments", label: `পেমেন্ট/কালেকশন seed${monthsBack > 1 ? ` (${monthsBack} মাস)` : ""}`, fn: async () => { if (farmers.length) await seedPayments(admin, officeId, farmers, monthsBack); }});
          }
          steps.push({ key: "verify_locations", label: "লোকেশন কাউন্ট যাচাই", fn: async () => {
            const v = await verifyLocations(admin);
            summary.location_verification = v;
            if (!v.ok) send({ type: "warn", step: "verify_locations", message: v.missing.join("; ") });
          }});
          steps.push({ key: "verify", label: "ভোটার ইন্টিগ্রিটি যাচাই", fn: async () => {
            const v = await verifyVoterIntegrity(admin);
            summary.verification = v;
            if (!v.ok) send({ type: "warn", step: "verify", message: v.issues.join("; ") });
          }});
          steps.push({ key: "verify_row_counts", label: "Row count + page mapping যাচাই", fn: async () => {
            const r = await verifyRowCounts(admin, modules);
            summary.row_count_report = r;
            if (!r.allOk) send({ type: "warn", step: "verify_row_counts", message: `${r.failed} required tables empty` });
          }});
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

        // Per-farmer seed log: every farmer with code, voter_number, account_number, and what was seeded
        if (farmers.length) {
          const seedLog = farmers.map((f: any) => ({
            farmer_code: f.farmer_code,
            is_voter: !!f.is_voter,
            voter_number: f.voter_number ?? null,
            account_number: f.account_number ?? null,
            savings_seeded: savingsFarmerIds.has(f.id),
            loans_seeded: loanFarmerIds.has(f.id),
            shares_seeded: sharesFarmerIds.has(f.id),
            fsp_seeded: fspFarmerIds.has(f.id),
          }));
          summary.seed_log = seedLog;
          send({ type: "seed_log", rows: seedLog });
        }

        await admin.from("demo_operations_log").insert({
          user_id: ctx.userId, user_email: ctx.userEmail, action, modules, size,
          ip: ctx.ip, user_agent: ctx.ua, success: true, summary,
        });

        send({ type: "complete", percent: 100, summary });
      } catch (e: any) {
        const errMsg = e?.message ?? String(e);
        let rollback_summary: any = null;
        // Transactional rollback: wipe partial data so DB doesn't end up in
        // an inconsistent half-seeded state. Only when the run actually
        // attempted to import (reset alone has nothing to roll back).
        if (transactional && (action === "import" || action === "both")) {
          send({ type: "step", key: "rollback", label: "ত্রুটি হয়েছে — partial data মুছছে (rollback)", percent: 99 });
          const wiped: Record<string, number | string> = {};
          for (const t of FULL_WIPE_ORDER) {
            try {
              const { count: before } = await admin.from(t).select("*", { count: "exact", head: true });
              const { error: derr } = await admin.from(t).delete().not("id", "is", null);
              wiped[t] = derr ? `error: ${derr.message}` : (before ?? 0);
            } catch (re: any) {
              wiped[t] = `error: ${re?.message ?? String(re)}`;
            }
          }
          rollback_summary = wiped;
          send({ type: "rollback", wiped });
        }
        try {
          await admin.from("demo_operations_log").insert({
            user_id: ctx.userId, user_email: ctx.userEmail, action, modules, size,
            ip: ctx.ip, user_agent: ctx.ua, success: false, error_message: errMsg,
            summary: { ...summary, rollback_summary, rolled_back: !!rollback_summary },
          });
        } catch (_) {/* */}
        controller.enqueue(encoder.encode(JSON.stringify({ type: "fatal", message: errMsg, rolled_back: !!rollback_summary, rollback_summary }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}

const AUDIT_LOG_TABLES = [
  "audit_logs", "voter_audit_logs", "import_audit_logs",
  "irrigation_rate_audit_logs", "irrigation_invoice_audit",
  "farmer_login_attempts", "farmer_rejections", "demo_operations_log",
];

async function clearAuditLogs(admin: any): Promise<Record<string, number | string>> {
  const out: Record<string, number | string> = {};
  for (const t of AUDIT_LOG_TABLES) {
    const { count: before } = await admin.from(t).select("*", { count: "exact", head: true });
    const { error } = await admin.from(t).delete().not("id", "is", null);
    out[t] = error ? `error: ${error.message}` : (before ?? 0);
  }
  return out;
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
    const action: "preview" | "reset" | "import" | "both" | "clear_audit" = body?.action ?? "both";

    // Preset (small/medium/large/loans_only/savings_only/irrigation_only)
    // overrides modules+size unless caller explicitly supplied them.
    const presetId: string | undefined = typeof body?.preset === "string" ? body.preset : undefined;
    const preset = presetId ? PRESETS[presetId] : undefined;
    if (presetId && !preset) return json({ error: `Unknown preset: ${presetId}` }, 400);

    const rawModules: string[] = Array.isArray(body?.modules) && body.modules.length
      ? body.modules
      : (preset?.modules ?? []);
    const modules: string[] = rawModules;
    const size: number = Math.max(5, Math.min(500,
      Number(body?.size) || preset?.size || 50,
    ));
    // transactional rollback default ON; caller may opt out with `transactional: false`
    const transactional: boolean = body?.transactional !== false;
    // 1-year operational seeding spread (default 1 = legacy point-in-time)
    const monthsBack: number = Math.max(1, Math.min(36,
      Number(body?.monthsBack) || preset?.monthsBack || 1,
    ));


    const voterCfg: VoterCfg = {
      voterRatio: Math.max(2, Math.min(20, Number(body?.voterCfg?.voterRatio) || 3)),
      voterNumberFormat: typeof body?.voterCfg?.voterNumberFormat === "string" && body.voterCfg.voterNumberFormat.trim()
        ? body.voterCfg.voterNumberFormat.trim().slice(0, 80) : "{seq:5}",
      // account_number must be exactly 5 digits; voter_number mirrors it.
      accountNumberFormat: typeof body?.voterCfg?.accountNumberFormat === "string" && body.voterCfg.accountNumberFormat.trim()
        ? body.voterCfg.accountNumberFormat.trim().slice(0, 80) : "{seq:5}",
    };

    if (action === "preview") {
      const wipePreview = await previewWipe(admin);
      const importPreview = estimateImport(modules, size);
      return json({ ok: true, action: "preview", wipe_preview: wipePreview, import_preview: importPreview, preset: presetId ?? null, resolved_modules: modules, resolved_size: size });
    }

    if (action === "clear_audit") {
      if (body?.confirm !== "CLEAR") return json({ error: "Confirmation required (confirm: 'CLEAR')" }, 400);
      const result = await clearAuditLogs(admin);
      return json({ ok: true, action: "clear_audit", cleared: result });
    }

    if (body?.confirm !== "RESET") return json({ error: "Confirmation required (confirm: 'RESET')" }, 400);

    const ctx = { userId: who.user.id, userEmail: who.user.email ?? null, ip, ua };
    const customNames = Array.isArray(body?.customNames)
      ? body.customNames.filter((r: any) => r && typeof r.en === "string" && r.en.trim()).slice(0, 1000)
      : undefined;

    if (body?.stream) return runStream(admin, action, modules, size, voterCfg, ctx, customNames, transactional, presetId, monthsBack);

    const resp = await runStream(admin, action, modules, size, voterCfg, ctx, customNames, transactional, presetId, monthsBack);

    const text = await resp.text();
    return json({ ok: true, log: text.split("\n").filter(Boolean).map((l) => JSON.parse(l)) });
  } catch (e: any) {
    console.error("demo-reset error:", e);
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
