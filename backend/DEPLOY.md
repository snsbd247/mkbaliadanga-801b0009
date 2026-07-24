# Deployment — VPS (mohammadkhani.com)

Laravel API backend + built React frontend on one Ubuntu/Nginx server.

## 1. Requirements
- PHP 8.2+ (`php-fpm php-mysql php-mbstring php-xml php-curl php-bcmath php-pgsql`)
- MySQL 8, Composer, Node 20, Nginx, Certbot

> `php-pgsql` is needed only once, for the `migrate:legacy` import from Supabase.

## 2. Database
```sql
CREATE DATABASE mk_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mk_erp'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL ON mk_erp.* TO 'mk_erp'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Backend
```bash
cd /var/www/mk/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env          # fill DB_*, APP_URL, PG_* (for import)
php artisan key:generate
php artisan migrate --seed     # creates schema + super admin (ismail162 / Admin@123)
php artisan migrate:legacy     # import existing Supabase data (PG_* required)
php artisan config:cache && php artisan route:cache
```

## 4. Frontend
```bash
cd /var/www/mk/frontend
echo "VITE_API_URL=https://mohammadkhani.com" > .env.production
npm ci && npm run build        # outputs dist/
```

## 5. Nginx
```nginx
server {
    server_name mohammadkhani.com www.mohammadkhani.com;
    root /var/www/mk/frontend/dist;
    index index.html;

    # API → Laravel public/
    location /api/ {
        root /var/www/mk/backend/public;
        try_files $uri /index.php?$query_string;
    }
    location ~ ^/index\.php$ {
        root /var/www/mk/backend/public;
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root/index.php;
    }

    # SPA fallback
    location / { try_files $uri $uri/ /index.html; }
}
```
```bash
sudo certbot --nginx -d mohammadkhani.com -d www.mohammadkhani.com
```

## 6. Verify
```bash
curl -X POST https://mohammadkhani.com/api/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"ismail162","password":"Admin@123"}'
```
Returns `{ token, user }` → backend live. Log in through the site and confirm each module.

## 7. cPanel / shared hosting (no root, SSH only)

Use `scripts/update-cpanel.sh` instead of `scripts/update.sh` — same data-safety
guarantees (DB backup first, `migrate --force` only, never `--seed`/`fresh`,
auto-rollback on failure), but with no root, systemctl, sudoers, or Nginx.

```bash
# one-time clone
git clone -b main https://github.com/snsbd247/mkbaliadanga-801b0009.git ~/mk_erp
cd ~/mk_erp/backend && cp .env.example .env   # fill DB_*, APP_URL
php artisan key:generate

# every later update
bash ~/mk_erp/scripts/update-cpanel.sh            # real deploy
bash ~/mk_erp/scripts/update-cpanel.sh --dry-run  # check only, no changes
```

`DOC_ROOT` (default `<APP_DIR>/public_html`) controls where the built frontend
is published; set it to your domain's actual document root if different, e.g.:
```bash
DOC_ROOT=/home/youruser/public_html bash ~/mk_erp/scripts/update-cpanel.sh
```
The script writes a `.htaccess` there for SPA routing (Apache has no Nginx-style
reload step, so there's nothing else to restart for code changes to take effect —
if PHP doesn't pick up the new code immediately, use cPanel's MultiPHP Manager /
"Restart PHP-FPM" for the domain).
