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
  "irrigation_sms_logs",
  "irrigation_invoice_payments", "irrigation_invoice_audit", "irrigation_invoices",
  "irrigation_charges", "irrigation_rates", "irrigation_season_rates", "irrigation_charge_settings",
  "savings_transactions", "savings_yearly_opening", "farmer_savings_plans", "savings_plans", "shares",
  "expenses",
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

async function seedFarmers(admin: any, officeId: string, count: number, cfg: VoterCfg, locs: LocPick[], customNames?: { en: string; bn?: string; father?: string; mother?: string; mobile?: string; nid?: string }[]) {
  const ratio = Math.max(2, Math.floor(cfg.voterRatio || 3));
  const year = new Date().getFullYear();
  const officeShort = officeId.slice(0, 4).toUpperCase();
  let voterSeq = 0;

  // De-dup: load existing farmer_codes/nids for this office to skip duplicates
  const { data: existing } = await admin.from("farmers")
    .select("farmer_code, nid, name_en").eq("office_id", officeId);
  const existingCodes = new Set((existing ?? []).map((x: any) => x.farmer_code));
  const existingNids = new Set((existing ?? []).map((x: any) => x.nid).filter(Boolean));
  const existingNames = new Set((existing ?? []).map((x: any) => x.name_en?.toLowerCase()));

  const desired = customNames?.length ? customNames.slice(0, count) : null;
  const total = desired ? desired.length : count;

  const farmers: any[] = [];
  for (let i = 0; i < total; i++) {
    const isVoter = i % ratio === 0;
    if (isVoter) voterSeq++;
    const tokenCtx = { seq: voterSeq, office: officeShort, year };
    const isFemale = i % 7 === 0;
    const fallback = isFemale ? pick(FEMALE_NAMES, i) : pick(MALE_NAMES, i);
    const custom = desired?.[i];
    const en = custom?.en?.trim() || fallback.en;
    const bn = custom?.bn?.trim() || fallback.bn;
    const father = custom?.father?.trim() || pick(FATHERS, i + 3).en;
    const mother = custom?.mother?.trim() || pick(MOTHERS, i + 5).en;
    const loc = locs.length ? locs[i % locs.length] : null;

    // Generate unique farmer_code by skipping existing
    let seq = i + 1;
    let code = `F-${String(seq).padStart(5, "0")}`;
    while (existingCodes.has(code)) { seq++; code = `F-${String(seq).padStart(5, "0")}`; }
    existingCodes.add(code);

    const nid = custom?.nid?.trim() || `19900${String(1000000000 + i).padStart(10, "0")}`;
    if (existingNids.has(nid)) continue; // skip duplicate NID
    if (existingNames.has(en.toLowerCase()) && !custom) continue; // skip duplicate generated name
    existingNids.add(nid);
    existingNames.add(en.toLowerCase());

    farmers.push({
      farmer_code: code,
      member_no: String(seq).padStart(7, "0"),
      name_en: en,
      name_bn: bn,
      father_name: father,
      mother_name: mother,
      mobile: custom?.mobile?.trim() || `017${String(10000000 + i).padStart(8, "0")}`,
      nid,
      village: loc?.mouza_name ?? pick(VILLAGES, i),
      office_id: officeId,
      status: "active",
      is_voter: isVoter,
      voter_number: isVoter ? formatToken(cfg.voterNumberFormat, tokenCtx) : null,
      account_number: isVoter ? formatToken(cfg.accountNumberFormat, tokenCtx) : null,
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

async function seedPatwaris(admin: any, officeId: string, locs: LocPick[]) {
  const names = [
    { en: "Md. Kamrul Hasan", bn: "মোঃ কামরুল হাসান" },
    { en: "Md. Abdul Latif",  bn: "মোঃ আব্দুল লতিফ" },
    { en: "Md. Shahin Alam",  bn: "মোঃ শাহিন আলম" },
    { en: "Md. Bashir Ahmed", bn: "মোঃ বশির আহমেদ" },
  ];
  const rows = names.map((n, i) => ({
    name: n.en, name_bn: n.bn,
    mobile: `018${String(20000000 + i).padStart(8, "0")}`,
    nid: `199${String(8000000000 + i).padStart(10, "0")}`,
    address: locs[i % Math.max(1, locs.length)]?.mouza_name ?? "",
    mouza_id: locs[i % Math.max(1, locs.length)]?.mouza_id ?? null,
    office_id: officeId, is_active: true,
  }));
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
  const { data, error } = await admin.from("lands").insert(lands).select("id, farmer_id, land_size, land_type_id, office_id");
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
    .select("id, farmer_id, owner_farmer_id, land_size, land_type_id, office_id")
    .eq("office_id", officeId);
  if (!lands?.length) return 0;

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
    const payable = +(irrigation + maintenance + canal).toFixed(2);
    const isPaid = i % 4 === 0;
    const isPartial = i % 4 === 1;
    const paid = isPaid ? payable : isPartial ? +(payable * 0.5).toFixed(2) : 0;
    return {
      invoice_no: `INV-${ts}-${String(i + 1).padStart(4, "0")}`,
      office_id: officeId,
      season_id: seasonId,
      land_id: l.id,
      owner_farmer_id: l.owner_farmer_id ?? l.farmer_id,
      farmer_id: l.farmer_id,
      is_borga: false,
      irrigation_amount: irrigation,
      maintenance_amount: maintenance,
      canal_amount: canal,
      delay_fee: 0, other_charge: 0,
      payable_amount: payable,
      paid_amount: paid,
      due_amount: +(payable - paid).toFixed(2),
      due_date: dueDate,
      invoice_status: isPaid ? "paid" : isPartial ? "partial_paid" : "generated",
      land_type_id: l.land_type_id,
      season_rate: rate,
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

async function seedLoans(admin: any, officeId: string, farmers: any[]) {
  const voters = farmers.filter((f: any) => f.is_voter);
  const seeded: string[] = [];
  const { data: plan } = await admin.from("loan_plans").insert({
    name: "Standard 12mo", name_bn: "১২ মাসের সাধারণ", office_id: officeId,
    duration_months: 12, interest_rate: 12, installment_type: "monthly",
    penalty_type: "percentage", penalty_value: 2, grace_period_days: 7, is_active: true,
  }).select("id").single();
  const planId = plan?.id ?? null;
  const targets = voters.slice(0, Math.ceil(voters.length * 0.4));
  const loanRows = targets.map((f, i) => {
    const principal = 10000 + (i % 5) * 5000;
    const totalPay = principal * 1.12;
    seeded.push(f.id);
    return {
      farmer_id: f.id, principal, interest_rate: 12, total_payable: totalPay, total_due: totalPay,
      installment_amount: totalPay / 12, plan_id: planId,
      status: i % 4 === 0 ? "pending" : "approved", office_id: officeId,
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

    const { data: ins } = await admin.from("loans").insert(loanRows).select("id, total_payable, status, issued_on");
    // Generate installment schedules + payments
    const allInst: any[] = [];
    const pays: any[] = [];
    const today = new Date();
    for (const l of (ins ?? [])) {
      if (l.status !== "approved") continue;
      const totalPay = Number(l.total_payable);
      const monthly = +(totalPay / 12).toFixed(2);
      const start = l.issued_on ? new Date(l.issued_on) : new Date(today.getTime() - 180 * 86400000);
      // 12 installments; first 3 paid, the past-due remaining ones become overdue, future ones stay due
      for (let n = 1; n <= 12; n++) {
        const due = new Date(start);
        due.setMonth(due.getMonth() + n);
        const paid = n <= 3;
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
      // Corresponding loan_payments rows for the 3 paid installments
      for (let n = 1; n <= 3; n++) {
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

async function seedSavings(admin: any, officeId: string, farmers: any[]) {
  const voters = farmers.filter((f: any) => f.is_voter);
  const savingsSeeded: string[] = [];
  const sharesSeeded: string[] = [];
  const fspSeeded: string[] = [];
  const { data: planRow } = await admin.from("savings_plans").insert({
    name: "DPS 24", name_bn: "ডিপিএস ২৪", office_id: officeId,
    duration_months: 24, installment_type: "monthly", installment_amount: 500,
    interest_rate: 6, maturity_type: "simple", is_active: true,
  }).select("id").single();
  const planId = planRow?.id ?? null;

  // Enroll ~30% of voters into a farmer_savings_plan
  if (planId) {
    const enrollTargets = voters.slice(0, Math.ceil(voters.length * 0.3));
    const fspRows = enrollTargets.map((f, i) => {
      const expected = 500 * 24;
      const interest = +(expected * 0.06 / 2).toFixed(2);
      fspSeeded.push(f.id);
      return {
        plan_id: planId, farmer_id: f.id, office_id: officeId,
        start_date: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
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
  const txns = targets.flatMap((f, i) => {
    savingsSeeded.push(f.id);
    return [
      { farmer_id: f.id, type: "deposit", amount: 1000 + (i % 5) * 200, status: "approved", office_id: officeId },
      ...(i % 4 === 0 ? [{ farmer_id: f.id, type: "withdraw", amount: 300, status: "approved", office_id: officeId }] : []),
      ...(i % 3 === 0 ? [{ farmer_id: f.id, type: "share_collection", amount: 500, status: "approved", office_id: officeId, note: "Demo share collection" }] : []),
    ];
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

async function seedPayments(admin: any, officeId: string, farmers: any[]) {
  if (!farmers.length) return;
  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const earlierMonth = new Date(Date.now() - 10 * 86400000).toISOString();
  const voters = farmers.filter((f: any) => f.is_voter);
  const rows = voters.flatMap((f, i) => {
    const out: any[] = [];
    if (i % 3 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 500 + (i % 5) * 100, status: "approved", office_id: officeId, created_at: today });
    if (i % 5 === 0) out.push({ farmer_id: f.id, kind: "loan", amount: 1000, status: "approved", office_id: officeId, created_at: today });
    if (i % 2 === 0) out.push({ farmer_id: f.id, kind: "irrigation", amount: 800, status: "approved", office_id: officeId, created_at: earlierMonth });
    if (i % 4 === 0) out.push({ farmer_id: f.id, kind: "savings", amount: 500, status: "approved", office_id: officeId, created_at: yesterday });
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
  // SMS settings — disabled by default for demo, but template fields populated
  await admin.from("sms_settings").upsert({
    id: 1, enabled: false,
    send_on_irrigation_payment: true, send_on_loan_payment: true,
    send_on_loan_approved: true,
    send_on_savings_deposit: true, send_on_savings_withdraw: true,
  } as any).then(() => {}).catch(() => {});
  // Default receipt settings (best-effort; ignore if shape differs)
  await admin.from("receipt_settings").upsert({ id: 1 } as any).then(() => {}).catch(() => {});
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
  if (modules.includes("farmers")) { c["farmers"] = size; c["lands"] = size; c["patwaris"] = 4; c["land_relations"] = Math.ceil(size / 7); }
  if (modules.includes("irrigation")) { c["seasons"] = 1; c["irrigation_charge_settings"] = 1; c["irrigation_season_rates"] = 3; c["irrigation_charges"] = size; c["irrigation_invoices"] = size; }
  if (modules.includes("loans")) { const n = Math.ceil(size * 0.4); c["loan_plans"] = 1; c["loans"] = n; c["loan_payments"] = Math.min(3, n); }
  if (modules.includes("savings")) { const n = Math.ceil(size * 0.6); c["savings_plans"] = 1; c["savings_transactions"] = n + Math.ceil(n / 4); c["shares"] = Math.ceil(size * 0.5); c["farmer_savings_plans"] = Math.ceil(n * 0.5); }
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
  customNames?: any[]) {

  const encoder = new TextEncoder();
  const summary: any = { action, modules, voterCfg };

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
          if (modules.includes("settings")) steps.push({ key: "settings", label: "সেটিংস seed (company/card/SMS/receipt)", fn: async () => { await seedSettings(admin); } });
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
              const p = await seedPatwaris(admin, officeId, locs); summary.patwaris = p.length;
            }});
          }
          const needFarmers = modules.includes("irrigation") || modules.includes("loans") || modules.includes("savings");
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
          if (modules.includes("loans")) steps.push({ key: "loans", label: "ঋণ seed (শুধু ভোটার)", fn: async () => {
            if (!farmers.length) return;
            const ids = await seedLoans(admin, officeId, farmers);
            ids.forEach((x) => loanFarmerIds.add(x));
          }});
          if (modules.includes("savings")) steps.push({ key: "savings", label: "সঞ্চয় + শেয়ার + প্ল্যান এনরোলমেন্ট seed (শুধু ভোটার)", fn: async () => {
            if (!farmers.length) return;
            const out = await seedSavings(admin, officeId, farmers);
            out.savingsSeeded.forEach((x) => savingsFarmerIds.add(x));
            out.sharesSeeded.forEach((x) => sharesFarmerIds.add(x));
            out.fspSeeded.forEach((x) => fspFarmerIds.add(x));
          }});
          if (modules.includes("expenses")) steps.push({ key: "expenses", label: "খরচ seed", fn: async () => { await seedExpenses(admin, officeId); }});
          if (modules.includes("farmers") || needFarmers) {
            steps.push({ key: "payments", label: "পেমেন্ট/কালেকশন seed", fn: async () => { if (farmers.length) await seedPayments(admin, officeId, farmers); }});
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
    const modules: string[] = Array.isArray(body?.modules) ? body.modules : [];
    const size: number = Math.max(5, Math.min(500, Number(body?.size) || 50));
    const voterCfg: VoterCfg = {
      voterRatio: Math.max(2, Math.min(20, Number(body?.voterCfg?.voterRatio) || 3)),
      voterNumberFormat: typeof body?.voterCfg?.voterNumberFormat === "string" && body.voterCfg.voterNumberFormat.trim()
        ? body.voterCfg.voterNumberFormat.trim().slice(0, 80) : "V-{seq:5}",
      accountNumberFormat: typeof body?.voterCfg?.accountNumberFormat === "string" && body.voterCfg.accountNumberFormat.trim()
        ? body.voterCfg.accountNumberFormat.trim().slice(0, 80) : "SAV-{seq:6}",
    };

    if (action === "preview") {
      const wipePreview = await previewWipe(admin);
      const importPreview = estimateImport(modules, size);
      return json({ ok: true, action: "preview", wipe_preview: wipePreview, import_preview: importPreview });
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

    if (body?.stream) return runStream(admin, action, modules, size, voterCfg, ctx, customNames);

    const resp = await runStream(admin, action, modules, size, voterCfg, ctx, customNames);
    const text = await resp.text();
    return json({ ok: true, log: text.split("\n").filter(Boolean).map((l) => JSON.parse(l)) });
  } catch (e: any) {
    console.error("demo-reset error:", e);
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
