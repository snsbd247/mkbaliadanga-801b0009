# Plan: ডেমো ইম্পোর্ট-কে এখন পর্যন্ত করা সব ফিচারের সাথে সিঙ্ক করা

## লক্ষ্য
ডেমো ইম্পোর্ট চালালেই যেন এখন পর্যন্ত বানানো **সব ফিচার** (বিশেষত নতুন A5 ল্যান্ডস্কেপ সেচ রশিদ) সম্পূর্ণ ডেটাসহ তৈরি হয় — অর্থাৎ ইম্পোর্টের পর কোনো invoice খুলে রশিদ প্রিন্ট করলে স্যাম্পলের মতো ১০০% মিলে যায় এবং প্রতিটি মডিউল বাস্তব ডেটা দেখায়।

## এখন কী আছে (যাচাই করা)
- `src/lib/demoPresets.ts` — preset তালিকা + প্রতি মডিউলের verify টেবিল ম্যাপ।
- `supabase/functions/demo-reset/index.ts` — আসল seeder (farmers, lands, borga relations, irrigation invoices/payments, loans+guarantors, savings, bank, cashbook, expenses, assets, land history/transfer/change-log)।
- বেশিরভাগ টেবিল ইতিমধ্যে seed হয়, কিন্তু **নতুন রশিদের জন্য দরকারি কিছু ফিল্ড/রো অনুপস্থিত**।

## ফাঁক (যা ঠিক করতে হবে)

### ১. সেচ ইনভয়েস — রশিদের সব ফিল্ড seed করা
বর্তমান `seedIrrigationInvoices` যা বাদ দিচ্ছে, রশিদে এগুলো লাগে:
- `land_type_name` ও `irrigation_category_name` (এখন শুধু `land_type_id`) → রশিদের "জমির ধরন" রো।
- `mouza` / `dag_no` — lands-এ আছে কিন্তু invoice select-এ আনা হয় না; রশিদ enrich path-এ লাগে।
- বর্গা invoice (`is_borga` সবসময় false) — অন্তত কিছু invoice borga করে দিতে হবে যাতে রশিদে "বর্গাদার / মালিক" ডিসপ্লে টেস্ট হয়।
- গত সিজনের **বকেয়া + বকেয়ার জরিমানা** এবং **হাল সিজনের জরিমানা** — কিছু invoice-এ due_charge/penalty বসাতে হবে যাতে রশিদের জরিমানা/বকেয়া/মোট রো বাস্তব দেখায়।
- holding/member তথ্য (`member_no`) invoice path-এ পৌঁছানো নিশ্চিত করা।

### ২. দুই সিজন তৈরি করা
এক সিজন (গত) আংশিক unpaid → চলতি সিজনে বকেয়া+জরিমানা দেখানোর জন্য, আরেক সিজন (চলতি) হাল চার্জের জন্য। এখন কার্যত এক সিজন seed হয়।

### ৩. `irrigation_due_promises` seed করা
verify-list-এ আছে কিন্তু seeder এটা ভরে না — কিছু due promise রো যোগ করা।

### ৪. সম্পাদকের স্বাক্ষর / লোগো / QR ডেমো অ্যাসেট
রশিদের নিচে অটো-স্বাক্ষর, হেডার লোগো ও QR — `company_settings`/receipt settings-এ ডেমো ভ্যালু (placeholder image) seed করা, যাতে ইম্পোর্টের পরই রশিদ পূর্ণরূপে দেখায়।

### ৫. preset metadata আপডেট
- "Full 1-Year Operational Demo" preset-এ উপরের নতুন ডেটা (two-season, borga, due+penalty, due_promises, signature) অন্তর্ভুক্ত করা।
- `recent_features` preset-এর বর্ণনা হালনাগাদ — "১০০% স্যাম্পল রশিদ রিপ্রোডিউসিবল" যোগ করা।

### ৬. verify ম্যাপ সম্পূর্ণ করা
`MODULE_VERIFY`-তে যেসব নতুন টেবিল missing (যেমন `irrigation_due_promises` required করা উচিত কিনা, signature settings) তা মিলিয়ে নেওয়া।

### ৭. টেস্ট
- বিদ্যমান `demoPresets.test.ts` আপডেট।
- নতুন একটি টেস্ট: seeded irrigation invoice-এ রশিদের প্রতিটি required ফিল্ড (land_type_name, mouza, dag_no, season_rate, due/penalty, borga display) non-null — যাতে ভবিষ্যতে demo রিগ্রেস না করে।

## টেকনিক্যাল নোট (ডেভেলপার-অংশ)
- `demoPresets.ts` ও edge function `demo-reset/index.ts` দুটোতেই পরিবর্তন mirror করতে হবে (Deno isolation, ফাইলের হেডারেই লেখা)।
- কোনো বিদ্যমান মডিউল না ভাঙা — শুধু seeder-এ ফিল্ড/রো যোগ ও দুই-সিজন লজিক; স্কিমা পরিবর্তন লাগলে নতুন migration (GRANT সহ)।
- পরিবর্তনের পর edge function রি-ডিপ্লয় করতে হবে।

## ডেলিভারেবল
ডেমো ইম্পোর্ট করলে: সব মডিউলে ডেটা + অন্তত একটি invoice যা খুলে প্রিন্ট করলে আপনার দেওয়া স্যাম্পলের সাথে ১০০% মিলবে (বর্গা, জরিমানা, বকেয়া, মৌজা, দাগ, জমির ধরন, স্বাক্ষর, QR সহ)।

---
**এটা শুধু প্ল্যান। আপনি বললে কোন অংশ আগে করব / সব একসাথে করব জানান।**
