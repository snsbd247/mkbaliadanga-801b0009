## স্কোপ

সাম্প্রতিক যেসব ফিচার/ফিক্স ৫টি জায়গায় রিফ্লেক্ট করব:

1. Loan No office-wise unique (DB index + form hint)
2. Member-wise Loan Summary (`/loans` পেজে)
3. Irrigation payment-এ Hawlat/Bank/Mobile Banking category
4. Combined Payment-এ farmer dues preview + Auto-download receipt
5. QR `/r/{token}` receipt-verify পেজ (genuine/masked mobile)
6. Form draft restore toast (farmer/loan/payment ফর্মে)
7. Tab-return page-refresh permanent ফিক্স (focus refetch off)
8. Farmer profile থেকে Edit করলে save-এর পর প্রোফাইলেই ফিরে আসা
9. Lands form-এ village/ward/union ছাড়া save করার ফিক্স

---

## ১. User Manual (PDF v4 + in-app /help page)

- `public/help/user-manual-v4.pdf` জেনারেট — `reportlab` দিয়ে স্ক্রিপ্ট
  - নতুন chapter: "Recent updates (2026 May)" উপরের ৯টা আইটেম স্ক্রিনশটসহ
  - বাকি chapter v3 থেকে port (table of contents আপডেট)
- In-app `/help` route যোগ:
  - `src/pages/Help.tsx` — markdown-driven, bn/en টগল, sidebar TOC
  - `public/help/manual.md` থেকে রেন্ডার (react-markdown)
  - PDF ডাউনলোড বাটন (v4)
- Sidebar nav-এ "Help / সহায়িকা" লিংক

## ২. Demo Import System

- `src/lib/demoPresets.ts`-এ নতুন preset আইটেম:
  - Sample loans (২টা, office-wise unique loan_no সহ)
  - Sample irrigation payment with Hawlat category
  - Sample combined payment
  - Sample QR token
- `src/pages/admin/DemoManager.tsx`-এ নতুন seed বাটন: "Seed recent-features demo"
- `supabase/functions/demo-reset/index.ts` — নতুন category গুলো reset scope-এ include
- `src/lib/assetDemoSeed.ts` — অপরিবর্তিত, কিন্তু validation pass করে

## ৩. ব্যাকেন্ড ফাইল (Laravel mirror)

`backend/` হল Laravel mirror (PHP); নতুন migrations:

- `2026_05_24_000001_add_loan_no_unique_index.php` — `loans (office_id, loan_no)` unique partial index
- `2026_05_24_000002_add_hawlat_bank_to_irrigation_payments.php` — `category` enum extend
- `2026_05_24_000003_create_qr_tokens_table.php` — token, payment_id, expires_at
- `2026_05_24_000004_add_verify_token_to_payments.php` — nullable column

Models update:
- `app/Models/Loan.php` — unique validation rule
- `app/Models/IrrigationPayment.php` — category enum cast
- `app/Models/QrToken.php` — new model
- `app/Models/Payment.php` — verify_token fillable

Controllers (API):
- `app/Http/Controllers/Api/QrController.php` — `GET /api/r/{token}` mirror of edge function
- `app/Http/Controllers/Api/LoanController.php` — duplicate loan_no error handling

## ৪. ডিফল্ট সিডার (DatabaseSeeder)

- `DatabaseSeeder.php`-এ run order: Roles → ChartOfAccounts → AdminUser → SequenceFix → (new) DemoOfficeSeeder optional
- `AdminUserSeeder.php` — `superadmin / Admin@123456` (current) verify
- নতুন `IrrigationCategorySeeder.php` — Hawlat/Bank/Mobile Banking default rows
- `ChartOfAccountsSeeder.php` — Hawlat/Bank ledger account add

## ৫. GeoSeeder

- `backend/database/seeders/GeoSeeder.php` — বর্তমানে DemoOfficeSeeder-এর ভিতরে hardcoded; আলাদা করব
- Source: `src/data/bd-geo.json` (existing) থেকে JSON read করে bulk insert:
  - divisions (8)
  - districts (64)
  - upazilas (~495)
  - unions (~4500)
  - mouzas (sample subset, full optional flag)
- Idempotent: `updateOrInsert` by `(parent_id, name_en)`
- DatabaseSeeder-এ wire করব (production-safe: শুধু empty হলে seed)

---

## Deliverables

- 1 PDF: `public/help/user-manual-v4.pdf`
- 1 markdown: `public/help/manual.md`
- 1 new page: `src/pages/Help.tsx` + route + sidebar link
- demoPresets/DemoManager edits
- 4 Laravel migrations + 4 models + 2 controllers
- 3 seeder files (new/updated): DatabaseSeeder, IrrigationCategorySeeder, GeoSeeder

## টেকনিক্যাল নোট

- Laravel ফাইলগুলো sandbox-এ run হয় না (frontend-only project), শুধু mirror হিসেবে রাখা — তাই কোনো DB মাইগ্রেশন এই কাজে চলবে না; Supabase-এ আগে থেকেই আছে
- PDF generation `code--exec` দিয়ে `/mnt/documents/`-এ আগে বানিয়ে QA করে তারপর `public/help/`-এ কপি
- GeoSeeder-এর পূর্ণ mouza ডেটা বড়; default-এ skip, `--with-mouzas` flag-এ enable

## প্রশ্ন

এই ৫টা স্কোপ + ৯টা ফিচার দিয়ে এগোব? নাকি প্রথমে শুধু **User Manual (PDF v4 + /help page)** শেষ করে দেখাব, তারপর demo/backend/seeder আলাদা টার্নে?
