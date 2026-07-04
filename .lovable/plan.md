## লক্ষ্য

আগের সফটওয়্যারের সেচ কালেকশন হিস্ট্রি (`irrigation_summary_report_excel`) একদম **আলাদা, স্বয়ংসম্পূর্ণ (self-contained) টেবিলে** ইমপোর্ট করা হবে। এটি বর্তমান কোনো মডিউল (farmers, lands, irrigation_invoices ইত্যাদি) এর সাথে যুক্ত হবে না — কোনো foreign key নেই, কোনো লজিক শেয়ার নেই। শুধু **ফার্মার কোড** (নামের ভেতরের `(2473)`) দিয়ে সেই কৃষকের পুরনো রেকর্ড খুঁজে দেখা যাবে।

এভাবে কোনো বিদ্যমান মডিউলে সমস্যা হওয়ার ঝুঁকি একদম শূন্য।

## নতুন যা যা তৈরি হবে

### ১. নতুন MySQL টেবিল (একটাই, আলাদা)
`legacy_irrigation_records` — Excel এর প্রতিটি সারি ঠিক যেমন আছে তেমন করে রাখা হবে:

```text
id (uuid)              legacy_farmer_code   farmer_name
father_name            village              mobile_no
mouza_name             season_year          land_shatak
dag_no                 rate                 owner_id_name
due_amount             paid_amount          owner_type_name
owner_father_name      owner_village        owner_mobile_no
owner_fid              receipt_no           collection_date
import_batch_id        created_at / updated_at
```
- `legacy_farmer_code` কলামে ইনডেক্স — দ্রুত সার্চের জন্য।
- `import_batch_id` — কোন ফাইল থেকে এসেছে বোঝার জন্য (ভুল হলে পুরো ব্যাচ মুছে ফেলা যাবে)।
- কোনো FK নেই → বিদ্যমান টেবিলে কোনো প্রভাব নেই।

### ২. Laravel ব্যাকএন্ড
- **Migration:** উপরের টেবিল তৈরি।
- **Model:** `LegacyIrrigationRecord`।
- **Controller + Routes:**
  - `POST /legacy-irrigation/import` — সারিগুলো bulk insert (batch সহ)।
  - `GET /legacy-irrigation?farmer_code=2473` — কোড দিয়ে রেকর্ড দেখা।
  - `DELETE /legacy-irrigation/batch/{id}` — ভুল ইমপোর্ট রোলব্যাক।
- অন্য কোনো Laravel ফাইল/মডেল ছোঁয়া হবে না।

### ৩. নতুন ফ্রন্টএন্ড পেজ
- নতুন রুট: `/legacy-import` (নতুন `LegacyIrrigationImport.tsx`)।
- ফাইল আপলোড → নামের ভেতর থেকে কোড অটো-বের করা → **প্রিভিউ টেবিল + ভ্যালিডেশন** (কত সারি, কোন সারিতে সমস্যা) → নিশ্চিত করলে সেভ।
- নতুন ভিউ পেজ: ফার্মার কোড লিখে সেই কৃষকের পুরনো সেচ রেকর্ড দেখা।
- বিদ্যমান ইমপোর্ট পেজগুলো (FarmersImport, IrrigationInvoiceImport ইত্যাদি) অপরিবর্তিত থাকবে।

## কলাম ম্যাপিং

```text
Excel কলাম        →  টেবিল কলাম
FARMER_NAME       →  farmer_name (+ কোড আলাদা করে legacy_farmer_code)
FATHER_NM         →  father_name
VILLAGE           →  village
MOBILE_NO         →  mobile_no
MOUZA_NAME        →  mouza_name
SESSON_YEAR       →  season_year        (যেমন "আমন-2025")
LAND              →  land_shatak
DAG_NO            →  dag_no
RATE              →  rate
OWNER_ID_NM       →  owner_id_name
DUE_AMOUNT        →  due_amount
PAID_AMOUNT       →  paid_amount
OWNER_TP_NAME     →  owner_type_name    (মালিক / বর্গাদার - নাম)
OWNER_FATHER_NM   →  owner_father_name
OWNER_VILLAGE     →  owner_village
OWNER_MOBILE_NO   →  owner_mobile_no
OWNER_FID         →  owner_fid
RECEIPT_NO        →  receipt_no
COLLECTION_DATE   →  collection_date    (03-JUL-2025 → date)
```

১,৯৫২ সারি এভাবেই বসে যাবে, কোনো তথ্য হারাবে না।

## গুরুত্বপূর্ণ নিশ্চয়তা
- বিদ্যমান কোনো টেবিল/মডিউল পরিবর্তন হবে না — সব একদম আলাদা।
- ভুল হলে পুরো ব্যাচ এক ক্লিকে মুছে আবার করা যাবে।
- অফিস অনুযায়ী স্কোপ রাখা হবে (আপনার লগইন অফিসেই সীমাবদ্ধ)।

## টেকনিক্যাল নোট
- ব্যাকএন্ড: `backend/` (Laravel/MySQL)। নতুন migration `backend/database/migrations/`-এ, Model `backend/app/Models/`-এ, Controller `backend/app/Http/Controllers/`-এ, রুট `backend/routes/api.php`-এ।
- ফ্রন্টএন্ড: `xlsx` লাইব্রেরি দিয়ে পার্স (বিদ্যমান import পেজের মতোই), `src/lib/api/` তে নতুন `legacyIrrigation.ts` API র‍্যাপার।
