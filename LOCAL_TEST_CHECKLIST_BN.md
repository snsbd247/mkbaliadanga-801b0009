# লোকাল টেস্ট চেকলিস্ট (মাইগ্রেশন ও ডেপ্লয়মেন্টের আগে)

এই চেকলিস্ট সম্পূর্ণ না হওয়া পর্যন্ত VPS-এ ডেপ্লয় করবেন না। প্রতিটি ধাপ
সফল হলে `[x]` টিক দিন।

---

## ০. পূর্বশর্ত
- [ ] PHP 8.2+, Composer, Node 20+, MySQL 8 লোকালে ইনস্টল করা আছে
- [ ] `erp-backend/.env` কনফিগার করা (`DB_CONNECTION=mysql`, DB নাম/ইউজার/পাস)
- [ ] dev-only ড্রাইভার ইনস্টল: `npm i pg mysql2`

## ১. স্কিমা মাইগ্রেশন (খালি DB)
```bash
cd erp-backend
php artisan migrate:fresh
```
- [ ] সব মাইগ্রেশন এরর ছাড়া রান হয়েছে
- [ ] `SHOW TABLES;` দিয়ে সব টেবিল আছে কিনা যাচাই

## ২. Seed data (অ্যাডমিন + রোল/পারমিশন)
```bash
php artisan db:seed
```
- [ ] সুপার অ্যাডমিন তৈরি হয়েছে (ইউজার: `ismail162`)
- [ ] রোল ও পারমিশন seed হয়েছে (`custom_roles`, `permissions`, `role_permissions`)
- [ ] ডিফল্ট অফিস তৈরি হয়েছে

## ৩. ডেটা মাইগ্রেশন (Postgres → MySQL)
```bash
# আগে শুধু প্রিভিউ
SUPABASE_DB_URL='postgres://…' MYSQL_URL='mysql://mkb_user:…@127.0.0.1:3306/mohammadkhani' \
  node scripts/migrate-supabase-to-laravel.mjs --dry-run

# তারপর আসল রান
SUPABASE_DB_URL='postgres://…' MYSQL_URL='mysql://…' \
  node scripts/migrate-supabase-to-laravel.mjs
```
- [ ] dry-run-এ row সংখ্যা প্রত্যাশিত
- [ ] `[→extra: …]` কলামগুলো ঠিকঠাক `extra` JSON-এ যাচ্ছে
- [ ] আসল রানে কোনো `✘` এরর নেই
- [ ] স্পট-চেক: `SELECT COUNT(*)` মিলিয়ে দেখা (farmers, lands, irrigation_invoices, receipts)

## ৪. API smoke test
```bash
php artisan serve   # http://127.0.0.1:8000
API_URL=http://127.0.0.1:8000/api API_EMAIL=ismail162 ADMIN_PASSWORD=Admin@123 \
  node scripts/api-smoke.mjs
```
- [ ] লগইন → টোকেন পাওয়া যায়
- [ ] মূল CRUD এন্ডপয়েন্ট 2xx রিটার্ন করে
- [ ] স্ক্রিপ্ট exit code 0

## ৫. API health-check (auth + scope + receipt concurrency)
```bash
API_URL=http://127.0.0.1:8000/api ADMIN_USER=ismail162 ADMIN_PASSWORD=Admin@123 \
  SCOPE_USER=<office_user> SCOPE_PASSWORD=<pass> \
  node scripts/api-healthcheck.mjs
```
- [ ] auth: ভুল পাসওয়ার্ড reject, টোকেন ছাড়া 401
- [ ] scope: scoped ইউজার শুধু নিজের অফিসের ডেটা দেখে
- [ ] receipt: কনকারেন্ট রিসিট নম্বর ইউনিক (ডুপ্লিকেট নেই)

## ৬. রোল টেস্ট (ম্যানুয়াল UI)
- [ ] সুপার অ্যাডমিন: সব মডিউল দেখা/এডিট
- [ ] অফিস অ্যাডমিন: শুধু নিজ অফিস
- [ ] সাধারণ ইউজার: সীমিত পারমিশন, নিষিদ্ধ পেজে 403
- [ ] সেচ vs সেভিং/লোন/শেয়ার ক্যাশ আলাদা থাকছে

## ৭. ফ্রন্টএন্ড বিল্ড (Laravel মোড)
```bash
echo "VITE_API_BASE_URL=http://127.0.0.1:8000/api" > .env.production.local
npm run build && npm run preview
```
- [ ] লগইন → ড্যাশবোর্ড লোড
- [ ] রিসিট প্রিন্ট/ভয়েড, সেচ/সেভিং রিপোর্ট ঠিক
- [ ] কনসোলে কোনো API এরর নেই

✅ সব টিক হলে তবেই ডেপ্লয় করুন।
