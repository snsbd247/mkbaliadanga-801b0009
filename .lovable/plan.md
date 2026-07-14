## সমস্যা

MASUD ALAM (মালিক) — Dag 223, মোট 0.665 শতক জমি; দুই বর্গাদার SOFIQUL (0.333) ও MD. A. SALAM (0.333)।

- ইনভয়েস **প্রিভিউ** এ সঠিক 0.333 দেখাচ্ছে ✅
- কিন্তু ইনভয়েস **সেভ** করার পর জমির পরিমাণ ও ক্যালকুলেশন পুরো 0.665 দেখাচ্ছে ❌
- সেই ইনভয়েসের **পেমেন্ট রিসিদ**েও 0.665 দেখাচ্ছে ❌

## মূল কারণ

`irrigation_invoices` টেবিলে জমির পরিমাণের জন্য কোনো নিজস্ব কলাম নেই (`area_decimal` নেই)। বর্তমানে বর্গার হিস্যা শুধু `calculation_snapshot.billed_area_shotok` JSON-এ যাচ্ছে।

ইনভয়েস/রিসিদ ডিসপ্লের বেশ কিছু জায়গা snapshot না পড়ে সরাসরি join-এ আসা `lands.land_size` (পুরো ডাগের 0.665) পড়ছে। ফলে টাকা সঠিক হলেও area ভুল দেখাচ্ছে; আবার কিছু জায়গায় area থেকে টাকাও পুনঃগণনা হচ্ছে বলে টাকাও ভুল দেখাচ্ছে।

## প্ল্যান

### ১. ডাটাবেসে নতুন কলাম যোগ (schema-only, ডাটা মুছবে না)
`irrigation_invoices` টেবিলে যোগ:
- `billed_area_shotok numeric` — এই ইনভয়েসে বিল করা প্রকৃত জমি (বর্গার হিস্যা বা পুরো ডাগ)
- `parcel_area_shotok numeric` — পুরো ডাগের মোট (রেফারেন্সের জন্য)
- `is_borga` কলাম আগেই আছে — ব্যবহার হবে

পুরনো ইনভয়েসগুলোর জন্য one-time backfill: `calculation_snapshot->>'billed_area_shotok'` না থাকলে `lands.land_size` কপি হবে। ফলে পুরনো নন-বর্গা ইনভয়েসে কিছু বদলাবে না।

### ২. ইনভয়েস তৈরির সময় নতুন কলাম fill করা
`src/pages/IrrigationInvoices.tsx` (bulk generate + single-land dialog উভয়) এর payload-এ যোগ:
```
billed_area_shotok: billedArea,
parcel_area_shotok: Number(row.land.land_size),
```
প্রিভিউতে যা 0.333 দেখাচ্ছে (`billedArea`) হুবহু সেটাই সেভ হবে। ক্যালকুলেশন লজিক ইতিমধ্যে `billedArea` দিয়েই হচ্ছে — শুধু persistence যোগ হবে।

### ৩. ডিসপ্লে সবখানে snapshot-first পড়া
`invoiceLandSize()` helper কে update করে priority:
1. `inv.billed_area_shotok` (নতুন কলাম)
2. `calculation_snapshot.billed_area_shotok`
3. fallback `inv.lands.land_size`

এই helper ব্যবহার করে সংশোধন হবে (শুধু presentation, business logic অক্ষত):
- ইনভয়েস তালিকা / প্রিন্ট view
- `src/lib/irrigationInvoicePdf.ts` (ইনভয়েস PDF)
- `src/lib/irrigationReceiptData.ts` + `bnReceipts.ts` (সেচ রশিদ area)
- `PaidLandHistory`, `IrrigationDueReport`, `InvoiceReport`, `FarmerStatement`, `FarmerProfileReport`

### ৪. Regression Guard
- অন্য মডিউল (Saving/Loan/Cashbook/Bank/Report totals) `irrigation_invoices.payable_amount / paid_amount / due_amount` পড়ে — সেগুলো অপরিবর্তিত থাকবে।
- ইনভয়েস তৈরি পেজের UI, rate override, manual rate, delay-fee, carry-forward — কোনোটাই touch হবে না।
- Type regeneration migration approve করার পরে হবে; তারপর কোড কম্পাইল হবে।

### ৫. Verification
1. উক্ত জমিতে একটি নতুন ইনভয়েস তৈরি → 0.333 শতক ও শুধু ঐ অংশের টাকা দেখা।
2. পেমেন্ট রিসিভ → রশিদে 0.333 দেখা।
3. পুরনো নন-বর্গা ইনভয়েস → আগের মতোই পুরো জমি (backfill এ mismatch থাকবে না)।
4. মালিকের নিজের হিস্যা যদি থাকত (এখানে 0) → সেটিও আলাদা row হিসেবে সঠিক।

## Technical Notes
- Migration: `ALTER TABLE public.irrigation_invoices ADD COLUMN ... ; UPDATE ... SET billed_area_shotok = COALESCE((calculation_snapshot->>'billed_area_shotok')::numeric, ...);` + `NOTIFY pgrst, 'reload schema';`
- কোনো RLS/policy পরিবর্তন নেই।
- কোনো নতুন RPC নেই।

অনুমতি দিলে বাস্তবায়ন শুরু করি।
