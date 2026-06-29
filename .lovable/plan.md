# পুরো অ্যাপ Laravel ব্যাকএন্ডে পোর্ট করার প্ল্যান

## সমস্যা (Root cause)
VPS-এ লগইন হয় **Laravel** ব্যাকএন্ডে (লোকাল MySQL), কিন্তু ১৩৩টি পেজ এখনো সরাসরি **Supabase Cloud**-এ কল করে (`supabase.from("offices").insert(...)`)। Supabase সেশন না থাকায় প্রতিটি create/update/delete RLS-এ আটকে যায় — এটাই "new row violates row-level security policy" এরর। মানে শুধু offices না, কার্যত **সব মডিউলেই** একই সমস্যা।

## লক্ষ্য
VPS-এ অ্যাপ সম্পূর্ণ স্ট্যান্ডঅলোন চলবে — সব ডেটা পড়া/লেখা Laravel API → MySQL-এ হবে। Lovable প্রিভিউ আগের মতোই Supabase-এ চলবে (একই কোডবেস, দুই ব্যাকএন্ড)।

## কৌশল: Backend-aware Data Adapter (সবচেয়ে কম-ঝুঁকির পথ)
১৩৩টি পেজ আলাদা করে রিরাইট করার বদলে একটি কম্প্যাট লেয়ার বানানো হবে যা Supabase-এর মতো API দেয় কিন্তু `BACKEND_MODE` অনুযায়ী রাউট করে:

```text
পেজ → db.from("table").select()/insert()/update()/delete()
            │
            ├── supabase mode → বর্তমান supabase client (অপরিবর্তিত)
            └── laravel mode  → REST কল → /api/<resource>  → MySQL
```

এতে পেজগুলোতে শুধু `import { supabase }` → `import { db }` বদলাতে হবে, লজিক প্রায় অক্ষত থাকবে।

## ধাপসমূহ (মডিউল-প্রায়োরিটি অনুযায়ী)

### Phase 0 — Adapter ভিত্তি
- `src/lib/db/index.ts`: backend-aware `db` ক্লায়েন্ট। `select` (eq/in/order/limit/single/range), `insert`, `update`, `delete`, এবং embedded relation (`mouzas(name)` ইত্যাদি) এর common subset সাপোর্ট।
- Laravel-side: একটি জেনেরিক resource কনভেনশন (প্রতি টেবিলের জন্য `index/show/store/update/destroy`) যাতে adapter ম্যাপ করতে পারে।
- ফলব্যাক: যে কুয়েরি adapter বুঝবে না, dev-এ স্পষ্ট error দেবে (silent fail নয়)।

### Phase 1 — Auth + Users/Roles/Offices/Audit
- Offices, Users, Roles, Permissions, Audit পেজ adapter-এ স্থানান্তর। (ব্যাকএন্ড controller আছে — যাচাই + ফাঁক পূরণ।)

### Phase 2 — Farmers + Lands + Geo
- Farmers (47 কলাম), FarmerDetail-এর 11 ট্যাব, Lands, Land Relations/Transfers/History, Mouza/Patwari/Geo।
- Land Transfer Integrity ও Borga লজিক Laravel-এ পোর্ট/যাচাই।

### Phase 3 — Irrigation (সেচ)
- Invoices, Charges, Categories/Rates, Season rates, Payments, রশিদ, Due clearance, Cashbook।

### Phase 4 — Savings / Loan / Share + Accounting
- Savings plans/transactions, Loans/installments/payments, Shares, Journals, Accounts, Vouchers, Bank, Cashbook।

### Phase 5 — বাকি মডিউল
- Assets (২০+ টেবিল), SMS, QR, Notifications, Reports, Settings, Demo/Import।
- Edge function-নির্ভর ফিচার (send-sms, reminders) Laravel কন্ট্রোলার/কমান্ডে রূপান্তর।

### Phase 6 — Cleanup ও যাচাই
- পুরনো `/api/*` ডুপ্লিকেট Api* পেজ ও Supabase-only কোড সরানো।
- প্রতিটি মডিউলে Playwright E2E (লগইন → list → create → edit → delete → রশিদ) VPS-মোডে।

## টেকনিক্যাল নোট
- প্রতিটি Phase শেষে আলাদা ডেলিভারি; প্রতি ধাপে বিল্ড + টেস্ট সবুজ রেখে এগোনো হবে যাতে কোনো মডিউল ভেঙে না যায়।
- Laravel-এ অনুপস্থিত টেবিলের জন্য migration + controller + route + RBAC scope যোগ হবে।
- `setup.sh`/`update.sh` অপরিবর্তিত; শুধু নতুন migration যুক্ত হবে।
- ঝুঁকি: Supabase-এর জটিল join/rpc কিছু পেজে আছে — সেগুলো adapter-এ না মিললে ঐ পেজ ম্যানুয়ালি Laravel endpoint-এ লেখা হবে।

## পরিমাণ ও ক্রম
বড় কাজ, তাই Phase-by-Phase এগোবো। আপনি চাইলে এখনই **Phase 0 + Phase 1 (Auth/Users/Roles/Offices)** দিয়ে শুরু করি — যাতে আপনার এখনকার Offices এরর সাথে সাথে ঠিক হয় — তারপর পরের Phase গুলো একে একে।
