# Implementation Plan — ১০টি কাজ ধাপে ধাপে

## ✅ সম্পন্ন

### ধাপ ১-৫
- Voter = Savings merge (UI auto-derive)
- Bulk Farmer Import (csv + xlsx, simplified template)
- Auto voter activation on import
- DataImport templates refresh
- Irrigation: ownership badge (নিজের / বর্গা)

### ধাপ ৬ — Patwari module (DB + Admin)
- Migration: `patwaris` table + RLS (auth read office-scoped, admin manage)
- `irrigation_charges.patwari_id` কলাম যোগ
- `src/pages/admin/Patwaris.tsx` — list/create/edit/deactivate
- App.tsx route `/admin/patwaris` + sidebar link

### ধাপ ৭ — Patwari profile page
- `src/pages/admin/PatwariDetail.tsx` — info + assigned farmers/lands (mouza-based) + override list

### ধাপ ৮ — Irrigation patwari select + receipt
- Irrigation form-এ Patwari dropdown
- Default: land-এর mouza অনুযায়ী active patwari auto-select
- Override badge: ✓ ডিফল্ট / ⚠️ মৌজার বাইরে
- Save: `patwari_id` persist
- Receipt: bnReceipts.ts-এ `patwari_name/patwari_mobile` field, irrigation block-এ "পাটুয়ারী: <name> (<mobile>)" line
- FarmerDetail.printIrrigation: patwari join + pass to receipt

### ধাপ ৯ — Farmer portal Bangla-only (lang force, toggle hidden)

## বাকি
### ধাপ ১০ — Overall flow polish
- Sidebar ordering / dependent pages smoke test
