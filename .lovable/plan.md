# Implementation Plan — ১০টি কাজ ধাপে ধাপে

প্রতিটি ধাপ আগের ধাপের উপর নির্ভরশীল, তাই sequence মেনে করব। প্রতিটি ধাপ শেষে relevant module test করব যেন কিছু না ভাঙে।

---

## ধাপ ১ — Voter = Savings Member merge (UI level)

**Decision**: `voter_number` থাকলেই active member। DB-তে `is_voter` column থাকবে (legacy data + immutability trigger), কিন্তু UI থেকে toggle সরবে এবং save করার সময় auto-derive হবে: `is_voter = !!voter_number`।

- Farmer create/edit dialog (`Farmers.tsx`, `FarmerDetail.tsx`): "Voter" toggle UI সরিয়ে দেব। শুধু `Voter Number` field থাকবে।
- Save handler: `is_voter = voter_number ? true : false` auto set।
- Display label: "Voter Number" → "Voter / Savings A/C No"।
- VoterList page label clarify।

## ধাপ ২ — Bulk Farmer Import: simplified template + xlsx

`src/pages/FarmersImport.tsx` update:
- Template columns শুধু: `farmer_id` (optional, internal id for update), `voter_number`, `name_en`, `name_bn`, `father_name`, `mobile`, `village`।
- File accept: `.csv,.xlsx`। Project-এ ইতিমধ্যে `xlsx` lib আছে (DataImport-এ ব্যবহৃত) — সেটাই reuse করব।
- Parser: extension detect করে csv বা xlsx route করবে।
- Sample template download button update (csv + xlsx দুটোই)।

## ধাপ ৩ — Auto voter activation on import

Import row processing: যদি `voter_number` cell-এ value থাকে → `is_voter = true` set হবে insert/update payload-এ।

## ধাপ ৪ — DataImport page module list refresh

`src/pages/DataImport.tsx` + `src/lib/importTemplates.ts`:
- Modules list verify করে current schema এর সাথে align করব।
- Templates এ existing column names match করব (যেমন payments-এ `account_number` → এখন voter_number-এর সাথে unified হলে সেটাও clarify)।
- যেগুলো deprecated বা broken — সরাব।

## ধাপ ৫ — Irrigation: জমির ownership badge

`src/pages/Irrigation.tsx` (Add/Edit dialog): farmer select হওয়ার পর land dropdown-এ প্রতিটা land-এর পাশে badge:
- "নিজের জমি" (owner_farmer_id == selected farmer)
- "বর্গা নেয়া" (land_relations table → sharecropper_farmer_id == selected farmer)

Selected হওয়ার পর form-এ summary line দেখাবে।

## ধাপ ৬ — Patwari module (DB + Admin)

**Migration**: নতুন table `patwaris` (name, mobile, mouza_id, office_id, is_active) + RLS (office-scoped admin manage, auth read)।

**Admin page**: `src/pages/admin/Patwaris.tsx` — list, create, edit, deactivate। App.tsx-এ route + sidebar link।

## ধাপ ৭ — Patwari profile page

`src/pages/admin/PatwariDetail.tsx`:
- Patwari info।
- Assigned mouza-এর সব land + সব farmer (mouza_id match) দেখাবে।
- Per-land override পরে এলে সেটাও list-এ দেখাবে (ধাপ ৮ এর পর)।

## ধাপ ৮ — Irrigation entry-তে Patwari select + receipt

Irrigation_charges table-এ `patwari_id` column add (migration)।

`Irrigation.tsx` Add/Edit dialog:
- Patwari select dropdown। Default: selected land-এর mouza-এর active patwari (auto-populate, override করা যাবে)।
- Save করার সময় `patwari_id` store।

Receipt template (`src/lib/bnReceipts.ts` / paymentReceiptPdf.ts): irrigation receipt-এ "পাটুয়ারী: <name> (<mobile>)" line যোগ।

## ধাপ ৯ — Farmer portal Bangla-only

- `FarmerPortalLogin.tsx` + `FarmerDashboard.tsx`: render-এ `useEffect(() => setLang('bn'), [])` force।
- LanguageToggle component conditionally hide (route-based check) — অথবা এই দুই page-এ render না করা।

## ধাপ ১০ — Overall flow polish

- Sidebar ordering check (Patwari menu add)।
- Dead links remove।
- Voter toggle remove হওয়ার পর dependent pages (DuesAudit, VoterList, Reports) verify।
- Build + key page smoke test।

---

## Technical Details

**Migrations needed** (২টা separate):
1. `CREATE TABLE patwaris` + RLS + trigger।
2. `ALTER TABLE irrigation_charges ADD COLUMN patwari_id UUID`।

**Files to modify (~20)**:
- Pages: `Farmers.tsx`, `FarmerDetail.tsx`, `FarmersImport.tsx`, `DataImport.tsx`, `Irrigation.tsx`, `VoterList.tsx`, `FarmerPortalLogin.tsx`, `FarmerDashboard.tsx`, `App.tsx`
- New: `admin/Patwaris.tsx`, `admin/PatwariDetail.tsx`
- Lib: `importTemplates.ts`, `farmerUpdateMapper.ts`, `bnReceipts.ts`, `paymentReceiptPdf.ts`
- Layout: `AppSidebar.tsx`, possibly `LanguageToggle` usage sites

**Risk areas**:
- Voter trigger immutability: সাবধান, existing voter_number কখনো clear হবে না।
- Patwari migration বড় — আগে approve নেব, তারপর code।
- Bulk import parser রিরাইট করলে existing flow না ভাঙে — incremental change করব।

**Approval flow**: প্রথমে ধাপ ১-৫ (no DB change) করব, তারপর migration approve নেব, তারপর ৬-৮ করব, শেষে ৯-১০।

ঠিক আছে কিনা জানালে শুরু করব।