# পুরনো ডেটা ইমপোর্ট — টেমপ্লেট ও ইনভয়েস-ভিত্তিক (বর্গা-সহ) মাইগ্রেশন প্ল্যান

লক্ষ্য: প্রতিটি জমির জন্য আলাদা ইনভয়েস, এবং এক জমি একাধিক জনের মধ্যে ভাগ (মালিক + বর্গাদার) থাকলে প্রত্যেকের জমির পরিমাপ অনুযায়ী আলাদা ইনভয়েস তৈরি হবে।

## ১. আপনাকে যে টেমপ্লেটগুলো দেবো

সফটওয়্যারে ঠিক যে ক্রমে ইমপোর্ট হবে, সেই ক্রমেই ৫টি CSV টেমপ্লেট (Bengali নির্দেশনা + স্যাম্পল সারি + UTF-8 BOM, Excel-এ খুললেই বাংলা ঠিক দেখাবে)। প্রতিটি টেমপ্লেট সংশ্লিষ্ট ইমপোর্ট পেজ থেকে "টেমপ্লেট ডাউনলোড" বাটনে পাওয়া যাবে।

```text
ক্রম  টেমপ্লেট          কী করে
1     lands            জমি তৈরি (account_number দিয়ে কৃষক ম্যাচ)
2     land_relations   বর্গা ভাগ (মালিক↔বর্গাদার, দাগভিত্তিক এলাকা/%)
3     irrigation       সেচ ইনভয়েস (প্রতি জমি প্রতি সিজন)
4     payments         পেমেন্ট কালেকশন (ইনভয়েস-ভিত্তিক)
5     opening_due      পুরনো বকেয়া মিলানো
```

### টেমপ্লেট ১ — জমি (lands)
কলাম: `account_number, dag_no, land_size, land_size_unit, owner_type, field_type, mouza, note`
- `land_size` = পুরো জমির মোট পরিমাপ (উদাহরণে ১০০ শতক), মালিকের নামেই একবার।
- `note` = জমির নোট (ইনভয়েস/রশিদে দেখাবে)।

### টেমপ্লেট ২ — বর্গা সম্পর্ক (land_relations)
কলাম: `owner_account_number, tenant_account_number, dag_no, borga_area, share_percentage, valid_from, valid_to, note`
- প্রতি বর্গাদারের জন্য একটি সারি। `borga_area` (শতক) দিলে সেটাই অগ্রাধিকার; নাহলে `share_percentage`।
- উদাহরণ (১০০ শতকের জমি):
  - সারি ১: মালিক 10001, বর্গাদার 10002, dag 123, borga_area **55**
  - সারি ২: মালিক 10001, বর্গাদার 10003, dag 123, borga_area **20**
  - বাকি **25** শতক স্বয়ংক্রিয়ভাবে মালিকের অংশ (আলাদা সারি লাগবে না)।

### টেমপ্লেট ৩ — সেচ ইনভয়েস (irrigation)
কলাম: `account_number, dag_no, season_year, season_type, base_charge, canal_charge, maintenance_charge, other_charge, previous_due_brought, penalty_amount, entry_date, note`
- এখানে `account_number` = জমির **মালিকের** সদস্য নম্বর, `dag_no` = ঐ জমি। প্রতি সারি = ঐ জমির ঐ সিজনের এক সেট চার্জ।
- ইমপোর্টার তখন land_relations দেখে **স্বয়ংক্রিয়ভাবে ভাগ করে প্রত্যেকের (মালিক + প্রতি বর্গাদার) নামে আলাদা ইনভয়েস** তৈরি করবে — চার্জ ও এলাকা প্রত্যেকের billed_area অনুপাতে ভাগ হবে (`splitBillableArea` লজিক ব্যবহার করে)।
- canal ও maintenance charge আগের নিয়ম অনুযায়ী payable-এ যোগ হবে না।

### টেমপ্লেট ৪ — পেমেন্ট (payments, ইনভয়েস-ভিত্তিক)
কলাম: `account_number, dag_no, season_year, season_type, amount, method, paid_on, note`
- `account_number` = যে ব্যক্তি (মালিক বা বর্গাদার) পরিশোধ করেছেন তার নম্বর; `dag_no`+সিজন দিয়ে তার নির্দিষ্ট ইনভয়েস ম্যাচ করে amount allocate হবে।

### টেমপ্লেট ৫ — ওপেনিং ডিউ (বিদ্যমান OpeningDueImport)

## ২. যা তৈরি/পরিবর্তন করব (technical)

1. `src/lib/importTemplates.ts` — `lands`-এ `note`, `land_relations`-এ `borga_area`, `irrigation` কলাম পরিমার্জন, নতুন invoice-ভিত্তিক `payments` কলাম (`dag_no, season_year, season_type, paid_on`)। সব টেমপ্লেটে বাংলা নির্দেশনা হালনাগাদ।
2. নতুন ইনভয়েস ইমপোর্ট UI পেজ `src/pages/IrrigationInvoiceImport.tsx` (৪-ধাপ wizard: আপলোড → ম্যাপিং → Dry-run প্রিভিউ (বর্গা-ভাগ দেখানো সহ) → কমিট), `import_audit_logs`-এ লগ।
3. ভাগের জন্য `splitBillableArea` (`irrigationBargaSplit.ts`) পুনর্ব্যবহার — প্রতি জমির প্রতি অংশীদারের জন্য পৃথক `irrigation_invoices` সারি।
4. ইনভয়েস-ভিত্তিক পেমেন্ট allocation বিদ্যমান `irrigationPaymentAllocation.ts` দিয়ে; ইমপোর্ট পেজে dag+season দিয়ে সঠিক ইনভয়েসে map।
5. রুট + মেনু এন্ট্রি যোগ; Dry-run/প্রিভিউ ও ছোট ব্যাচ যাচাই।

## ৩. নিরাপত্তা
- সব ইমপোর্ট প্রথমে Dry-run; office-scope isolate; `import_audit_logs` লগ; অন্য মডিউল অপরিবর্তিত।

---
অনুমোদন দিলে আগে টেমপ্লেটগুলো তৈরি করে দেবো (আপনি ডাউনলোড করে ভরতে পারবেন), তারপর ইনভয়েস ইমপোর্ট পেজ + বর্গা-ভাগ লজিক ডেভেলপ করব।