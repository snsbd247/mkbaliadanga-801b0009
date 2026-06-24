# ট্রাবলশুটিং গাইড (Nginx / PHP-FPM / MySQL / Certbot)

প্রতিটি সমস্যার জন্য: **লক্ষণ → কারণ → ফিক্স কমান্ড**। সব কমান্ড root হিসেবে চালান।

---

## প্রথমে স্ট্যাটাস দেখুন
```bash
systemctl status nginx php8.2-fpm mysql --no-pager
journalctl -xe --no-pager | tail -50
tail -n 80 /var/www/erp/erp-backend/storage/logs/laravel.log
```

---

## Nginx

### 502 Bad Gateway
- **কারণ:** PHP-FPM বন্ধ বা সকেট পাথ ভুল।
```bash
systemctl status php8.2-fpm
ls -l /run/php/php8.2-fpm.sock          # সকেট আছে কিনা
# nginx vhost-এ fastcgi_pass মিলিয়ে দেখুন:
grep fastcgi_pass /etc/nginx/sites-available/erp
systemctl restart php8.2-fpm && systemctl reload nginx
```

### 404 on refresh / deep link
- **কারণ:** SPA fallback নেই।
```nginx
# vhost-এর location / ব্লকে:
location / { try_files $uri $uri/ /index.php?$query_string; }
```
```bash
nginx -t && systemctl reload nginx
```

### "nginx: [emerg] ... config test failed"
```bash
nginx -t            # ঠিক কোন লাইনে এরর দেখায়
systemctl reload nginx
```

---

## PHP-FPM

### সাদা পেজ / 500 Internal Server Error
```bash
tail -n 80 /var/www/erp/erp-backend/storage/logs/laravel.log
# permission ঠিক করুন:
chown -R www-data:www-data /var/www/erp/erp-backend/storage /var/www/erp/erp-backend/bootstrap/cache
chmod -R 775 /var/www/erp/erp-backend/storage /var/www/erp/erp-backend/bootstrap/cache
php -v   # 8.2 কিনা যাচাই
```

### "Class not found" / autoload এরর
```bash
cd /var/www/erp/erp-backend
composer install --no-dev --optimize-autoloader
php artisan optimize:clear
```

### কনফিগ/রুট ক্যাশ পুরোনো
```bash
cd /var/www/erp/erp-backend
php artisan config:clear && php artisan route:clear && php artisan view:clear
php artisan config:cache && php artisan route:cache
```

---

## MySQL

### "SQLSTATE[HY000] [2002] Connection refused"
```bash
systemctl status mysql
systemctl restart mysql
# erp-backend/.env-এ DB_HOST=127.0.0.1, DB_PORT=3306 যাচাই
```

### "Access denied for user"
```bash
mysql -u root -p
# তারপর:
# ALTER USER 'mkb_user'@'localhost' IDENTIFIED BY 'নতুন_পাস';
# GRANT ALL PRIVILEGES ON mohammadkhani.* TO 'mkb_user'@'localhost';
# FLUSH PRIVILEGES;
# .env-এ DB_PASSWORD আপডেট করে: php artisan config:cache
```

### "Specified key was too long" (মাইগ্রেশনে)
- **ফিক্স:** `erp-backend/app/Providers/AppServiceProvider.php`-এ `Schema::defaultStringLength(191);` (boot-এ) যোগ করা আছে কিনা দেখুন, তারপর:
```bash
php artisan migrate:fresh --seed
```

### ডিস্ক ফুল / টেবিল লক
```bash
df -h
mysqladmin -u root -p processlist
```

---

## Certbot / SSL

### "Failed authorization procedure" (HTTP-01)
- **কারণ:** ৮০ পোর্ট বন্ধ বা DNS এখনো প্রপাগেট হয়নি।
```bash
dig +short mohammadkhani.com          # সার্ভার IP দেখাচ্ছে কিনা
ufw allow 80,443/tcp
nginx -t && systemctl reload nginx
certbot --nginx -d mohammadkhani.com -d www.mohammadkhani.com
```

### সার্টিফিকেট মেয়াদ / রিনিউ
```bash
certbot certificates
certbot renew --dry-run     # রিনিউ টেস্ট
systemctl list-timers | grep certbot
```

### "Too many certificates already issued" (rate limit)
- staging দিয়ে টেস্ট করুন, পরে production:
```bash
certbot --nginx --staging -d mohammadkhani.com
```

---

## দ্রুত হেলথ-চেক
```bash
curl -I https://mohammadkhani.com
API_URL=https://mohammadkhani.com/api ADMIN_USER=ismail162 ADMIN_PASSWORD=Admin@123 \
  node /var/www/erp/scripts/api-healthcheck.mjs
```

কিছু ঠিক না হলে: `bash deploy/vps/rollback.sh` দিয়ে আগের ব্যাকআপে ফিরে যান।
