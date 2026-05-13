/**
 * MK Baliadanga — full seed
 * Idempotent: re-running is safe (uses upsert + existence checks).
 *
 * Seeds:
 *   - 1 Office (MK Baliadanga)
 *   - Settings + Chart of Accounts
 *   - Locations: 1 Division → 1 District → 1 Upazila → 2 Mouzas
 *   - Users: super_admin, admin, manager, operator, viewer  (passwords logged once)
 *   - 50 Farmers + lands
 *   - 2 Seasons (Boro, Aman) + rates
 *   - Savings accounts + transactions
 *   - Loans + installments + a few payments
 *   - Irrigation invoices + payments
 *   - Asset categories + assets + stocks
 *
 * Env overrides:
 *   SEED_SUPER_EMAIL, SEED_SUPER_PASSWORD
 *   SEED_FARMER_COUNT (default 50)
 */
import { PrismaClient, AppRole, AssetTrackingMode, AssetStatus, LoanStatus, InstallmentStatus, InvoiceStatus } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const SUPER_EMAIL    = process.env.SEED_SUPER_EMAIL    || "admin@mohammadkhani.com";
const SUPER_PASSWORD = process.env.SEED_SUPER_PASSWORD || "ChangeMe!2025";
const FARMER_COUNT   = Number(process.env.SEED_FARMER_COUNT || 50);

const bnDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
const toBn = (n: number | string) => String(n).split("").map(c => /\d/.test(c) ? bnDigits[+c] : c).join("");
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

async function ensureUser(email: string, password: string, fullName: string, officeId: string, role: AppRole) {
  const hash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password_hash: hash, email_verified: true },
  });
  await prisma.profile.upsert({
    where: { user_id: user.id },
    update: { full_name: fullName, office_id: officeId },
    create: { user_id: user.id, full_name: fullName, office_id: officeId, language: "bn" },
  });
  await prisma.userRole.upsert({
    where: { user_id_office_id_role: { user_id: user.id, office_id: officeId, role } },
    update: {},
    create: { user_id: user.id, office_id: officeId, role },
  });
  return user;
}

async function main() {
  console.log("▶ Seeding MK Baliadanga...");

  // ---- Office ----
  const office = await prisma.office.upsert({
    where: { code: "MKB" },
    update: {},
    create: {
      code: "MKB",
      name_en: "MK Baliadanga",
      name_bn: "এমকে বালিয়াডাঙ্গা",
      address: "Baliadanga, Bangladesh",
      phone: "+8801700000000",
    },
  });
  console.log("  ✓ office:", office.code);

  // ---- Settings ----
  await prisma.setting.upsert({
    where: { office_id: office.id },
    update: {},
    create: {
      office_id: office.id,
      cooperative_name: "MK Baliadanga Agricultural Cooperative",
      cooperative_bn: "এমকে বালিয়াডাঙ্গা কৃষি সমবায় সমিতি",
      default_language: "bn",
      fiscal_year_start: 7,
      data: { qr_enabled: true, sms_enabled: true },
    },
  });

  // ---- Locations ----
  const division = await prisma.division.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name_en: "Rajshahi", name_bn: "রাজশাহী" },
  });
  const district = await prisma.district.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000002", division_id: division.id, name_en: "Chapainawabganj", name_bn: "চাঁপাইনবাবগঞ্জ" },
  });
  const upazila = await prisma.upazila.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000003", district_id: district.id, name_en: "Shibganj", name_bn: "শিবগঞ্জ" },
  });
  const mouzas = await Promise.all([
    prisma.mouza.upsert({
      where: { id: "00000000-0000-0000-0000-000000000010" },
      update: {},
      create: { id: "00000000-0000-0000-0000-000000000010", upazila_id: upazila.id, name_en: "Baliadanga", name_bn: "বালিয়াডাঙ্গা", jl_no: "101" },
    }),
    prisma.mouza.upsert({
      where: { id: "00000000-0000-0000-0000-000000000011" },
      update: {},
      create: { id: "00000000-0000-0000-0000-000000000011", upazila_id: upazila.id, name_en: "Notunhat", name_bn: "নতুনহাট", jl_no: "102" },
    }),
  ]);

  // ---- Users ----
  await ensureUser(SUPER_EMAIL, SUPER_PASSWORD, "Super Admin", office.id, AppRole.super_admin);
  await ensureUser("admin@mkb.local",    "Admin@123",    "অ্যাডমিন",  office.id, AppRole.admin);
  await ensureUser("manager@mkb.local",  "Manager@123",  "ম্যানেজার", office.id, AppRole.manager);
  await ensureUser("operator@mkb.local", "Operator@123", "অপারেটর",   office.id, AppRole.operator);
  await ensureUser("viewer@mkb.local",   "Viewer@123",   "ভিউয়ার",   office.id, AppRole.viewer);
  await ensureUser("developer@mkb.local", "Developer@123", "ডেভেলপার", office.id, AppRole.developer);
  console.log("  ✓ users (6)");

  // ---- Chart of Accounts ----
  const coa = [
    { code: "1000", type: "asset",     name_en: "Cash",            name_bn: "নগদ" },
    { code: "1100", type: "asset",     name_en: "Bank",            name_bn: "ব্যাংক" },
    { code: "1200", type: "asset",     name_en: "Loans Receivable", name_bn: "ঋণ প্রাপ্য" },
    { code: "2000", type: "liability", name_en: "Savings Payable", name_bn: "সঞ্চয় দেনা" },
    { code: "3000", type: "equity",    name_en: "Capital",         name_bn: "মূলধন" },
    { code: "4000", type: "income",    name_en: "Irrigation Revenue", name_bn: "সেচ আয়" },
    { code: "4100", type: "income",    name_en: "Loan Interest",   name_bn: "ঋণ সুদ" },
    { code: "5000", type: "expense",   name_en: "Operating Expenses", name_bn: "পরিচালন ব্যয়" },
  ];
  for (const a of coa) {
    await prisma.account.upsert({
      where: { office_id_code: { office_id: office.id, code: a.code } },
      update: {},
      create: { office_id: office.id, ...a },
    });
  }
  console.log("  ✓ chart of accounts (8)");

  // ---- Seasons + rates ----
  const boro = await prisma.season.upsert({
    where: { id: "00000000-0000-0000-0000-000000000100" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000100",
      office_id: office.id, name: "Boro 2025", type: "boro",
      start_date: new Date("2025-01-01"), end_date: new Date("2025-05-31"), is_active: true,
    },
  });
  const aman = await prisma.season.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      office_id: office.id, name: "Aman 2024", type: "aman",
      start_date: new Date("2024-07-01"), end_date: new Date("2024-12-31"), is_active: false,
    },
  });
  for (const s of [boro, aman]) {
    if ((await prisma.seasonRate.count({ where: { season_id: s.id } })) === 0) {
      await prisma.seasonRate.createMany({
        data: [
          { season_id: s.id, category: "a", rate_per_dec: 25 },
          { season_id: s.id, category: "b", rate_per_dec: 22 },
          { season_id: s.id, category: "c", rate_per_dec: 18 },
        ],
      });
    }
  }
  console.log("  ✓ seasons + rates");

  // ---- Farmers ----
  const existingFarmers = await prisma.farmer.count({ where: { office_id: office.id } });
  if (existingFarmers < FARMER_COUNT) {
    const firstNames = ["মোঃ আব্দুল","মোঃ রফিক","মোঃ করিম","মোঃ জসিম","মোঃ হাসান","মোঃ আলম","মোঃ রহিম","মোঃ সেলিম","মোঃ আনিস","মোঃ মামুন"];
    const lastNames  = ["ইসলাম","হোসেন","মিয়া","শেখ","আলী","হক","উদ্দিন","রহমান","কবির","মোল্লা"];
    for (let i = existingFarmers + 1; i <= FARMER_COUNT; i++) {
      const code = `MKB-${String(i).padStart(4, "0")}`;
      const fname = `${pick(firstNames)} ${pick(lastNames)}`;
      await prisma.farmer.create({
        data: {
          office_id: office.id,
          farmer_code: code,
          voter_no: toBn(1000 + i),
          name_bn: fname,
          father_name: `মোঃ ${pick(lastNames)}`,
          phone: `01${pick(["3","5","7","8","9"])}${String(10000000 + i).padStart(8, "0")}`,
          mouza_id: pick(mouzas).id,
          is_voter: true,
        },
      });
    }
    console.log(`  ✓ farmers (${FARMER_COUNT})`);
  } else {
    console.log(`  ↷ farmers already seeded (${existingFarmers})`);
  }

  const farmers = await prisma.farmer.findMany({ where: { office_id: office.id }, take: FARMER_COUNT });

  // ---- Lands ----
  if ((await prisma.land.count({ where: { office_id: office.id } })) === 0) {
    for (const f of farmers) {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        await prisma.land.create({
          data: {
            office_id: office.id, farmer_id: f.id, mouza_id: f.mouza_id,
            dag_no: String(100 + Math.floor(Math.random() * 900)),
            khatian_no: String(10 + Math.floor(Math.random() * 90)),
            area_decimal: Math.round((20 + Math.random() * 200) * 100) / 100,
            land_type: pick(["own", "borga", "lease"]),
          },
        });
      }
    }
    console.log("  ✓ lands");
  }

  // ---- Savings ----
  if ((await prisma.savingsAccount.count({ where: { office_id: office.id } })) === 0) {
    for (const f of farmers) {
      const acc = await prisma.savingsAccount.create({
        data: {
          office_id: office.id, farmer_id: f.id,
          account_no: `SAV-${f.farmer_code}`, balance: 0,
        },
      });
      let bal = 0;
      const txns = 2 + Math.floor(Math.random() * 4);
      for (let t = 0; t < txns; t++) {
        const dep = 200 + Math.floor(Math.random() * 1500);
        bal += dep;
        await prisma.savingsTransaction.create({
          data: { account_id: acc.id, txn_date: new Date(), type: "deposit", amount: dep },
        });
      }
      if (Math.random() < 0.3) {
        const w = Math.floor(bal * 0.2);
        bal -= w;
        await prisma.savingsTransaction.create({
          data: { account_id: acc.id, txn_date: new Date(), type: "withdraw", amount: w },
        });
      }
      await prisma.savingsAccount.update({ where: { id: acc.id }, data: { balance: bal } });
    }
    console.log("  ✓ savings accounts + transactions");
  }

  // ---- Loans ----
  if ((await prisma.loan.count({ where: { office_id: office.id } })) === 0) {
    const loanFarmers = farmers.slice(0, Math.min(15, farmers.length));
    let i = 0;
    for (const f of loanFarmers) {
      i++;
      const principal = 10000 + Math.floor(Math.random() * 40000);
      const term = 12;
      const loan = await prisma.loan.create({
        data: {
          office_id: office.id, farmer_id: f.id,
          loan_no: `LN-${String(i).padStart(4, "0")}`,
          principal, interest_rate: 12, term_months: term,
          disbursed_date: new Date(), status: LoanStatus.active,
        },
      });
      const monthly = Math.round((principal * 1.12) / term);
      for (let m = 1; m <= term; m++) {
        const due = new Date(); due.setMonth(due.getMonth() + m);
        const paid = m <= 2;
        await prisma.loanInstallment.create({
          data: {
            loan_id: loan.id, due_date: due, amount_due: monthly,
            amount_paid: paid ? monthly : 0,
            paid_at: paid ? new Date() : null,
            status: paid ? InstallmentStatus.paid : InstallmentStatus.due,
          },
        });
      }
    }
    console.log("  ✓ loans + installments");
  }

  // ---- Irrigation invoices ----
  if ((await prisma.irrigationInvoice.count({ where: { office_id: office.id } })) === 0) {
    let n = 0;
    for (const f of farmers) {
      const lands = await prisma.land.findMany({ where: { farmer_id: f.id } });
      const totalArea = lands.reduce((s, l) => s + Number(l.area_decimal), 0);
      if (totalArea <= 0) continue;
      n++;
      const rate = 25;
      const amount = Math.round(totalArea * rate);
      const inv = await prisma.irrigationInvoice.create({
        data: {
          office_id: office.id, farmer_id: f.id, season_id: boro.id,
          invoice_no: `INV-B25-${String(n).padStart(4, "0")}`,
          invoice_date: new Date(), area_decimal: totalArea,
          rate, amount, paid_amount: 0, status: InvoiceStatus.issued,
        },
      });
      if (Math.random() < 0.5) {
        const pay = Math.floor(amount * (Math.random() < 0.5 ? 1 : 0.5));
        await prisma.irrigationPayment.create({
          data: { invoice_id: inv.id, payment_date: new Date(), amount: pay, method: "cash" },
        });
        await prisma.irrigationInvoice.update({
          where: { id: inv.id },
          data: { paid_amount: pay, status: pay >= amount ? InvoiceStatus.paid : InvoiceStatus.partial },
        });
      }
    }
    console.log("  ✓ irrigation invoices + payments");
  }

  // ---- Assets ----
  const eqCat = await prisma.assetCategory.upsert({
    where: { office_id_code: { office_id: office.id, code: "EQ" } },
    update: {},
    create: {
      office_id: office.id, code: "EQ",
      name_en: "Equipment", name_bn: "যন্ত্রপাতি",
      tracking_mode: AssetTrackingMode.serial,
    },
  });
  const consCat = await prisma.assetCategory.upsert({
    where: { office_id_code: { office_id: office.id, code: "CONS" } },
    update: {},
    create: {
      office_id: office.id, code: "CONS",
      name_en: "Consumables", name_bn: "ভোগ্যপণ্য",
      tracking_mode: AssetTrackingMode.quantity,
    },
  });
  const assetSamples = [
    { code: "PUMP-001",  cat: eqCat.id,   name_en: "Pump 5HP",  name_bn: "পাম্প ৫ এইচপি", price: 45000, status: AssetStatus.installed,  unit: "pcs", track: AssetTrackingMode.serial },
    { code: "MOTOR-002", cat: eqCat.id,   name_en: "Motor 3HP", name_bn: "মোটর ৩ এইচপি",   price: 32000, status: AssetStatus.in_stock,   unit: "pcs", track: AssetTrackingMode.serial },
    { code: "PIPE-003",  cat: consCat.id, name_en: "PVC Pipe",  name_bn: "পিভিসি পাইপ",     price: 250,   status: AssetStatus.in_stock,   unit: "ft",  track: AssetTrackingMode.quantity },
  ];
  for (const a of assetSamples) {
    const asset = await prisma.asset.upsert({
      where: { office_id_asset_code: { office_id: office.id, asset_code: a.code } },
      update: {},
      create: {
        office_id: office.id, asset_category_id: a.cat,
        asset_code: a.code, name_en: a.name_en, name_bn: a.name_bn,
        purchase_price: a.price, current_status: a.status,
        unit: a.unit, tracking_mode: a.track,
        serial_no: a.track === AssetTrackingMode.serial ? `SN-${a.code}` : null,
      },
    });
    if ((await prisma.assetStock.count({ where: { asset_id: asset.id } })) === 0) {
      await prisma.assetStock.create({
        data: { office_id: office.id, asset_id: asset.id, quantity: a.unit === "ft" ? 120 : 1 },
      });
    }
  }
  console.log("  ✓ asset categories + assets + stocks");

  console.log("\n✅ Seed complete\n");
  console.log("─────────────────────────────────────────────");
  console.log(" Login credentials (change immediately!):");
  console.log(`   super_admin : ${SUPER_EMAIL}  /  ${SUPER_PASSWORD}`);
  console.log("   admin       : admin@mkb.local      /  Admin@123");
  console.log("   manager     : manager@mkb.local    /  Manager@123");
  console.log("   operator    : operator@mkb.local   /  Operator@123");
  console.log("   viewer      : viewer@mkb.local     /  Viewer@123");
  console.log("─────────────────────────────────────────────");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
