# SETUP_GUIDE_BN — মোহাম্মদখানি ERP (Laravel + MySQL) VPS সেটআপ গাইড

এই গাইড অনুসরণ করে আপনি Supabase থেকে সরে নিজের VPS-এ **Laravel 11 API + MySQL 8**
ব্যাকএন্ড দিয়ে অ্যাপটি চালাতে পারবেন। ফ্রন্টএন্ড (React/Vite) build হয়ে Laravel-এর
`public/` ফোল্ডার থেকে serve হবে।

---

## ০. কী কী লাগবে

- একটি ফ্রেশ **Ubuntu 22.04 / 24.04** VPS (root access)
- ডোমেইন **mohammadkhani.com** — VPS-এর IP-তে `A` রেকর্ড (root + www) পয়েন্ট করা
- আপনার কোড রিপোজিটরির git URL

---

## ১. এক-কমান্ড ইনস্টল (সবচেয়ে সহজ)

VPS-এ root হিসেবে লগইন করে চালান:

```bash
DOMAIN=mohammadkhani.com \
REPO_URL=https://github.com/আপনার/রিপো.git \
DB_PASSWORD='একটি-শক্তিশালী-পাসওয়ার্ড' \
bash deploy/vps/install.sh
```

স্ক্রিপ্ট স্বয়ংক্রিয়ভাবে করবে:
1. Nginx, PHP 8.2-FPM, MySQL 8, Node 20, Composer, Certbot ইনস্টল
2. MySQL ডাটাবেস + ইউজার তৈরি
3. রিপো ক্লোন → `/var/www/erp`
4. Laravel `.env` তৈরি, `key:generate`, `migrate --seed`
5. ফ্রন্টএন্ড build → `erp-backend/public/`
6. Nginx vhost + Let's Encrypt SSL

শেষে: `https://mohammadkhani.com` — লগইন **ismail162 / Admin@123**

> ⚠️ প্রথম লগইনের পর অবশ্যই সুপার অ্যাডমিন পাসওয়ার্ড পরিবর্তন করুন।

---

## ২. ম্যানুয়াল সেটআপ (ধাপে ধাপে)

### ২.১ ব্যাকএন্ড
```bash
cd /var/www/erp/erp-backend
cp .env.example .env
# .env এ DB_DATABASE, DB_USERNAME, DB_PASSWORD, APP_URL ঠিক করুন
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force --seed
php artisan config:cache && php artisan route:cache
```

### ২.২ ফ্রন্টএন্ড build
```bash
cd /var/www/erp
echo "VITE_API_BASE_URL=https://mohammadkhani.com/api" > .env.production.local
npm ci && npm run build
cp -r dist/* erp-backend/public/
```

### ২.৩ পারমিশন
```bash
chown -R www-data:www-data erp-backend/storage erp-backend/bootstrap/cache
chmod -R 775 erp-backend/storage erp-backend/bootstrap/cache
```

---

## ৩. লোকাল টেস্ট (deploy করার আগে)

ব্যাকএন্ড:
```bash
cd erp-backend
cp .env.example .env && php artisan key:generate
# লোকাল MySQL সেট করে:
php artisan migrate --seed
php artisan serve --port=8000      # http://localhost:8000/api
```

ফ্রন্টএন্ড (Laravel মোডে):
```bash
echo "VITE_API_BASE_URL=http://localhost:8000/api" > .env.local
npm run dev                         # http://localhost:8080
```

> `VITE_API_BASE_URL` সেট না থাকলে অ্যাপ Supabase মোডে চলে (Lovable preview ভাঙবে না)।

লগইন টেস্ট:
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"ismail162","password":"Admin@123"}'
```

---

## ৪. কোড আপডেট (পরবর্তী deploy)

```bash
cd /var/www/erp
bash deploy/vps/update.sh
```
git pull → composer → migrate → frontend rebuild → cache clear → reload.

---

## ৫. গুরুত্বপূর্ণ নিরাপত্তা নোট

- সব secret কেবল `erp-backend/.env`-এ — কখনো কোডে hardcode নয়।
- MySQL-এ RLS নেই; access control সম্পূর্ণ Laravel middleware
  (`CheckPermission`, `BranchScope`) দিয়ে — office isolation + RBAC।
- Roles আলাদা `user_custom_roles` টেবিলে।
- নিয়মিত ব্যাকআপ: `mysqldump mohammadkhani > backup.sql`।

---

## ৬. ট্রাবলশুটিং

| সমস্যা | সমাধান |
|---|---|
| 500 error | `tail -f erp-backend/storage/logs/laravel.log` |
| CORS error | `.env`-এ `CORS_ALLOWED_ORIGINS` ও `SANCTUM_STATEFUL_DOMAINS` ঠিক করুন |
| SSL fail | DNS প্রোপাগেট হলে `certbot --nginx -d mohammadkhani.com -d www.mohammadkhani.com` |
| 419 / token | `php artisan config:cache` চালান, ব্রাউজার localStorage clear করুন |
| migrate fail | MySQL 8 ও utf8mb4 নিশ্চিত করুন |
