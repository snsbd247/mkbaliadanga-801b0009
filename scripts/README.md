# 🚀 mkbaliadanga — VPS One-Command Installer

ফ্রেশ Ubuntu VPS এ পুরো অ্যাপ (Laravel API + React frontend + Postgres + Redis + MinIO + Nginx + SSL) সেটাপ করতে শুধু **একটা command**।

---

## ⚡ Quick Install

আপনার VPS এ root হিসেবে SSH করে এই command চালান:

```bash
curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/install.sh \
  | sudo DOMAIN=mohammadkhani.com EMAIL=admin@mohammadkhani.com bash
```

⏱️ আনুমানিক সময়: **২০–৩০ মিনিট**।

---

## ✅ আগে থেকে যা যা দরকার

1. **Fresh Ubuntu 22.04 / 24.04 VPS** (root SSH access)
2. **VPS IP**: `153.75.248.223`
3. **Domain DNS records** (A record) — VPS IP-এ point করানো:
   - `mohammadkhani.com`        → A → `153.75.248.223`
   - `www.mohammadkhani.com`    → A → `153.75.248.223`
   - `api.mohammadkhani.com`    → A → `153.75.248.223`
4. **Email address** (SSL renewal নোটিফিকেশনের জন্য)

> ⚠️ DNS propagate না হলে SSL fail করবে। `dig mohammadkhani.com` দিয়ে আগে confirm করুন।

---

## 🎯 যা যা Install হবে

| Component | Purpose |
|-----------|---------|
| Docker + Compose | Container runtime |
| PostgreSQL 16 (Docker) | Primary database |
| Redis 7 (Docker) | Cache + queue + sessions |
| MinIO (Docker) | S3-compatible file storage |
| Laravel API + php-fpm + nginx (Docker) | Backend (`api.mohammadkhani.com`) |
| Queue worker + Scheduler (Docker) | Background jobs |
| Node.js 20 | Frontend build tool |
| Nginx (host) | Reverse proxy + static frontend serve |
| Certbot (Let's Encrypt) | Free SSL |
| UFW + fail2ban | Firewall (22, 80, 443 only) |
| Daily Backup Cron | প্রতি রাত ২টায় auto pg_dump + MinIO mirror |

---

## 🔑 Install শেষ হলে

সব credentials এখানে save হবে:

```
/root/mkbaliadanga-credentials.txt
```

⚠️ **এই file টা কপি করে নিরাপদ জায়গায় (password manager / Drive) রাখুন।**

### Default Login Accounts (Seeder থেকে তৈরি)

| Role | User ID | Password |
|------|---------|----------|
| Developer + Super Admin | `ismail162` | `123456` |
| Super Admin | `superadmin` | `Admin@123456` |

> Login URL: `https://mohammadkhani.com/api/auth`
> Farmer login: `https://mohammadkhani.com/api/farmer-login`

---

## 🛠 দরকারি Commands (Install এর পর)

```bash
# Code update + redeploy (নতুন push করলে)
sudo bash /home/mkadmin/mkbaliadanga/scripts/update.sh

# Manual backup এখনই নিতে
sudo bash /home/mkadmin/mkbaliadanga/scripts/backup.sh

# Health check
sudo bash /home/mkadmin/mkbaliadanga/scripts/healthcheck.sh

# Backend logs
cd /home/mkadmin/mkbaliadanga/backend && docker compose logs -f app

# সব container restart
cd /home/mkadmin/mkbaliadanga/backend && docker compose restart

# Nginx (host) reload
sudo systemctl reload nginx

# Laravel artisan
docker exec mkb_app php artisan <command>
```

---

## 📂 File Locations

| কী | কোথায় |
|----|------|
| Repo (frontend + backend) | `/home/mkadmin/mkbaliadanga` |
| Backend `.env` | `/home/mkadmin/mkbaliadanga/backend/.env` |
| Built frontend (live) | `/var/www/mohammadkhani.com` |
| Backups | `/var/backups/mkbaliadanga` |
| Credentials | `/root/mkbaliadanga-credentials.txt` |
| Host nginx vhost | `/etc/nginx/sites-available/mohammadkhani.com.conf` |

---

## 🌐 Custom Domain বা Email

```bash
curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-801b0009/main/scripts/install.sh \
  | sudo DOMAIN=yourdomain.com \
         API_SUB=api.yourdomain.com \
         EMAIL=you@yourdomain.com \
         APP_USER=myuser \
         bash
```

---

## ❓ Troubleshooting

1. **SSL fail** → DNS propagate হয়নি। ১ ঘণ্টা পর:
   ```bash
   sudo certbot --nginx -d mohammadkhani.com -d www.mohammadkhani.com -d api.mohammadkhani.com
   ```

2. **Container start না হলে**:
   ```bash
   cd /home/mkadmin/mkbaliadanga/backend
   docker compose logs app postgres
   docker compose down && docker compose up -d
   ```

3. **502 Bad Gateway on api.** → app container down। উপরের command চালান।

4. **Migration আবার চালাতে**:
   ```bash
   docker exec mkb_app php artisan migrate --force
   docker exec mkb_app php artisan db:seed --force
   ```

5. **Disk full** →
   ```bash
   docker system prune -a
   sudo journalctl --vacuum-time=7d
   ```

---

## 🔄 Re-run Safe

Script idempotent — মাঝে fail করলে আবার চালালে যেখান থেকে থেমেছিল continue করবে। Existing `.env` ও database delete হবে না।

---

## 📦 Repo & Domain

- **GitHub**: https://github.com/snsbd247/mkbaliadanga-801b0009.git
- **Domain**: https://mohammadkhani.com
- **API**:    https://api.mohammadkhani.com/api
- **VPS IP**: 153.75.248.223
