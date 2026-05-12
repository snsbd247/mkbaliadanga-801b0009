# 🚀 mkbaliadanga — VPS One-Command Installer

একদম fresh Ubuntu VPS-এ পুরো application setup করতে শুধু **একটা command** চালাতে হবে।

---

## ⚡ Quick Install (এক command)

আপনার VPS-এ root হিসেবে SSH করে এই command চালান:

```bash
curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-2fdd2e7e/main/scripts/install.sh | sudo DOMAIN=mohammadkhani.com EMAIL=your@email.com bash
```

**ব্যাস!** ৩০-৪৫ মিনিট পর সব ready।

---

## ✅ যা যা দরকার (আগে থেকে)

1. **Fresh Ubuntu 22.04 / 24.04 VPS** (root SSH access সহ)
2. **Domain DNS already pointed** to VPS IP:
   - `mohammadkhani.com` → A record → আপনার VPS IP
   - `www.mohammadkhani.com` → A record → আপনার VPS IP
   - `api.mohammadkhani.com` → A record → আপনার VPS IP
3. **Email address** (SSL renewal notification-এর জন্য)

---

## 🎯 যা যা Install হবে

| Component | Purpose |
|-----------|---------|
| Docker + Compose | Container runtime |
| Self-hosted Supabase | PostgreSQL + Auth + Storage + API + Studio |
| Node.js 20 | Frontend build tool |
| Nginx | Reverse proxy + static file server |
| Certbot (Let's Encrypt) | Free SSL certificate |
| UFW Firewall | Port 22, 80, 443 only |
| Daily Backup Cron | প্রতি রাত ২টায় auto backup |

---

## 🔑 Install শেষ হলে

সব credentials (database password, JWT keys, dashboard password) এখানে save হবে:

```
/root/mkapp-credentials.txt
```

⚠️ **এই file টা copy করে safe জায়গায় রাখুন** (Google Drive, password manager — যেখানে চান)।

---

## 🛠 দরকারি Command (Install-এর পর)

```bash
# App update (নতুন code push করলে)
sudo -u mkadmin /home/mkadmin/update.sh

# এখনই backup নিতে চাইলে
sudo /usr/local/bin/mk-backup.sh

# Supabase logs দেখতে
cd /home/mkadmin/supabase-project && docker compose logs -f

# সব restart
cd /home/mkadmin/supabase-project && docker compose restart

# Nginx restart
sudo systemctl reload nginx
```

---

## 📂 File Locations

| কী | কোথায় |
|----|------|
| Frontend code | `/home/mkadmin/mkapp` |
| Built files (live) | `/var/www/mohammadkhani.com` |
| Supabase config | `/home/mkadmin/supabase-project` |
| Backups | `/var/backups/mkapp` |
| Credentials | `/root/mkapp-credentials.txt` |
| Nginx configs | `/etc/nginx/sites-available/` |

---

## 🌐 Custom Domain বা Email

Default values change করতে চাইলে:

```bash
curl -fsSL https://raw.githubusercontent.com/snsbd247/mkbaliadanga-2fdd2e7e/main/scripts/install.sh \
  | sudo DOMAIN=yourdomain.com \
         API_SUBDOMAIN=api.yourdomain.com \
         EMAIL=you@yourdomain.com \
         APP_USER=myuser \
         bash
```

---

## ❓ সমস্যা হলে

1. **SSL fail করেছে** → DNS এখনো propagate হয়নি। ১ ঘণ্টা পর manually:
   ```bash
   sudo certbot --nginx -d mohammadkhani.com -d www.mohammadkhani.com -d api.mohammadkhani.com
   ```

2. **Container start হচ্ছে না** →
   ```bash
   cd /home/mkadmin/supabase-project
   docker compose logs db
   docker compose down && docker compose up -d
   ```

3. **502 Bad Gateway** → Supabase container down। উপরের command চালান।

4. **Disk full** →
   ```bash
   docker system prune -a
   sudo journalctl --vacuum-time=7d
   ```

---

## 🔄 Re-run Safe

Script idempotent — মাঝে fail করলে আবার চালালে যেখান থেকে থেমেছিল সেখান থেকেই continue করবে। Existing data delete হবে না।

---

বিস্তারিত বাংলা guide-এর জন্য দেখুন: `VPS-Setup-Guide-Bangla.pdf`
