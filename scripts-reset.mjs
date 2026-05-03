import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, service, { auth: { persistSession: false } });

async function main() {
  // 1. Delete all auth users
  console.log("Deleting auth users...");
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (!data.users.length) break;
    for (const u of data.users) {
      const { error: dErr } = await admin.auth.admin.deleteUser(u.id);
      if (dErr) console.warn("del", u.email, dErr.message);
    }
    if (data.users.length < 200) break;
  }

  // 2. Wipe transactional + reference tables (preserve schema, settings, accounts)
  const tables = [
    "voter_audit_logs",
    "payment_allocations", "payments", "loan_payments", "loan_installments", "loans",
    "irrigation_charges", "irrigation_rates",
    "savings_transactions", "savings_yearly_opening", "farmer_savings_plans", "savings_plans",
    "shares", "expenses", "receipts",
    "ledger_entries", "journal_entry_lines", "journal_entries",
    "land_relations", "lands", "farmer_otps", "farmer_portal_sessions",
    "qr_tokens", "sms_logs", "notifications", "audit_logs", "farmer_rejections",
    "farmers",
    "user_roles", "profiles",
    // locations - wipe everything to reseed minimal
    "mouzas", "wards", "unions", "upazilas", "post_offices", "districts", "divisions",
    "loan_plans",
    "offices",
  ];

  for (const t of tables) {
    const { error } = await admin.from(t).delete().not("id", "is", null);
    if (error && !/does not exist/i.test(error.message)) {
      console.warn(`wipe ${t}: ${error.message}`);
    } else console.log(`wiped ${t}`);
  }

  // 3. Create office
  const officeId = "11111111-1111-1111-1111-111111111111";
  await admin.from("offices").insert({ id: officeId, name: "Chapainawabganj Office", address: "Chapainawabganj, Rajshahi" });

  // 4. Locations
  console.log("Seeding locations...");
  const { data: div } = await admin.from("divisions").insert({ name: "Rajshahi", name_bn: "রাজশাহী", code: "RAJ" }).select("id").single();
  const { data: dist } = await admin.from("districts").insert({ division_id: div.id, name: "Chapainawabganj", name_bn: "চাঁপাইনবাবগঞ্জ", code: "CHN" }).select("id").single();

  const upazilas = [
    { name: "Chapainawabganj Sadar", name_bn: "চাঁপাইনবাবগঞ্জ সদর" },
    { name: "Shibganj", name_bn: "শিবগঞ্জ" },
    { name: "Gomastapur", name_bn: "গোমস্তাপুর" },
    { name: "Nachole", name_bn: "নাচোল" },
    { name: "Bholahat", name_bn: "ভোলাহাট" },
  ];
  const { data: upzs } = await admin.from("upazilas").insert(upazilas.map(u => ({ ...u, district_id: dist.id }))).select("id, name");

  // unions: 1 per upazila
  const unionRows = upzs.map(u => ({ upazila_id: u.id, name: `${u.name} Union`, name_bn: `${u.name} ইউনিয়ন` }));
  const { data: unions } = await admin.from("unions").insert(unionRows).select("id, upazila_id, name");

  // wards & mouzas under first union (sadar)
  const sadarUnion = unions.find(u => u.name.includes("Sadar")) ?? unions[0];
  const { data: wards } = await admin.from("wards").insert([
    { union_id: sadarUnion.id, name: "Ward 1", name_bn: "ওয়ার্ড ১", ward_no: "1" },
    { union_id: sadarUnion.id, name: "Ward 2", name_bn: "ওয়ার্ড ২", ward_no: "2" },
  ]).select("id, name");

  const { data: mouzas } = await admin.from("mouzas").insert([
    { ward_id: wards[0].id, union_id: sadarUnion.id, name: "Rehaichar", name_bn: "রেহাইচর" },
    { ward_id: wards[0].id, union_id: sadarUnion.id, name: "Baliadanga", name_bn: "বালিয়াডাঙ্গা" },
  ]).select("id, name");

  // 5. Super admin user
  console.log("Creating super admin...");
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email: "superadmin@local.app",
    password: "Admin@123",
    email_confirm: true,
    user_metadata: { full_name: "Super Admin", username: "superadmin" },
  });
  if (uErr) throw uErr;
  await admin.from("profiles").upsert({
    id: u.user.id, email: "superadmin@local.app", username: "superadmin",
    full_name: "Super Admin", office_id: officeId,
  });
  await admin.from("user_roles").insert({ user_id: u.user.id, role: "super_admin" });

  // 6. 10 demo farmers
  console.log("Seeding farmers...");
  const sadarUpz = upzs.find(u => u.name.includes("Sadar"));
  const farmers = Array.from({ length: 10 }, (_, i) => ({
    farmer_code: `CHN-${String(i + 1).padStart(4, "0")}`,
    member_no: `M${String(i + 1).padStart(4, "0")}`,
    name_en: `Demo Farmer ${i + 1}`,
    name_bn: `ডেমো কৃষক ${i + 1}`,
    father_name: `Father ${i + 1}`,
    mother_name: `Mother ${i + 1}`,
    mobile: `+880170000${String(1000 + i)}`,
    nid: `19900000000000${String(i).padStart(2, "0")}`,
    village: mouzas[i % 2].name,
    mouza: mouzas[i % 2].name,
    mouza_id: mouzas[i % 2].id,
    ward_id: wards[0].id,
    union_id: sadarUnion.id,
    upazila_id: sadarUpz.id,
    district_id: dist.id,
    division_id: div.id,
    office_id: officeId,
    status: "active",
    is_voter: i < 5,
  }));
  const { data: insertedFarmers, error: fErr } = await admin.from("farmers").insert(farmers).select("id");
  if (fErr) throw fErr;

  // assign voter_number to first 5 via RPC isn't accessible w/o auth; do direct update with unique numbers
  for (let i = 0; i < 5; i++) {
    await admin.from("farmers").update({ voter_number: `V-${String(1001 + i)}` }).eq("id", insertedFarmers[i].id);
  }

  // 7. Lands & samples
  const lands = insertedFarmers.map((f, i) => ({
    farmer_id: f.id, land_size: 0.5 + (i % 5) * 0.25,
    mouza: mouzas[i % 2].name, mouza_id: mouzas[i % 2].id,
    dag_no: `D${100 + i}`, field_type: "medium_land", owner_type: "owner",
    office_id: officeId,
  }));
  await admin.from("lands").insert(lands);

  await admin.from("savings_transactions").insert(
    insertedFarmers.slice(0, 5).map(f => ({ farmer_id: f.id, type: "deposit", amount: 1000, status: "approved", office_id: officeId }))
  );

  await admin.from("loans").insert({
    farmer_id: insertedFarmers[0].id, principal: 10000, interest_rate: 12,
    total_payable: 11200, status: "approved", office_id: officeId,
  });

  console.log("DONE. farmers:", insertedFarmers.length);
}

main().catch(e => { console.error(e); process.exit(1); });
