# Database Management Guide (VPS)

VPS এ MK Baliadanga এর সব ডাটা PostgreSQL 16 ডকার কন্টেইনার `mkb_postgres` এ থাকে।
এই গাইডে সব কমন ডাটাবেজ কাজের কমান্ড দেওয়া আছে।

> Container names: `mkb_app` (Laravel), `mkb_postgres` (DB), `mkb_redis`, `mkb_minio`, `mkb_pgadmin` (GUI)
> DB user: `mkb_user` · DB name: `mkbaliadanga` · Password: `/root/mkbaliadanga-credentials.txt`

---

## 1. pgAdmin (Browser GUI) — সবচেয়ে সহজ

`install.sh` চালালে pgAdmin অটো ইনস্টল হয়।

- **URL:** `http://YOUR_VPS_IP:5050`
- **Login:** `ismailsagor162@gmail.com` / `Admin@123456`

প্রথমবার লগইন করার পর Server যোগ করুন:

| Field | Value |
|------|------|
| Name | MK Baliadanga |
| Host | `postgres` |
| Port | `5432` |
| Database | `mkbaliadanga` |
| Username | `mkb_user` |
| Password | `/root/mkbaliadanga-credentials.txt` থেকে |

---

## 2. psql Console (Terminal)

```bash
docker exec -it mkb_postgres psql -U mkb_user -d mkbaliadanga
```

ভিতরে:
```sql
\dt              -- সব টেবিল
\d users         -- টেবিল structure
\du              -- ইউজার
SELECT count(*) FROM users;
\q               -- বের হওয়া
```

---

## 3. Migration (নতুন টেবিল/কলাম)

```bash
docker exec mkb_app php artisan migrate --force
docker exec mkb_app php artisan migrate:status        # status দেখুন
docker exec mkb_app php artisan migrate:rollback --force  # শেষ batch undo
```

---

## 4. Seeder (ডামি/রেফারেন্স ডাটা)

```bash
docker exec mkb_app php artisan db:seed --force
docker exec mkb_app php artisan db:seed --class=DemoSeeder --force
```

পুরা reset + fresh seed (**⚠️ সব ডাটা মুছে যাবে**):
```bash
docker exec mkb_app php artisan migrate:fresh --seed --force
```

Admin Panel থেকে আরো সহজ: **Quick Seed** ও **Demo Manager** পেজ ব্যবহার করুন।

---

## 5. Backup

স্বয়ংক্রিয়: প্রতিদিন রাত ২টায় cron জব ব্যাকআপ নেয় → `/opt/mkbaliadanga-backups/`

ম্যানুয়াল backup:
```bash
sudo bash /home/mkadmin/mkbaliadanga/scripts/backup.sh
```

ডিরেক্ট pg_dump:
```bash
docker exec mkb_postgres pg_dump -U mkb_user mkbaliadanga | gzip > ~/mkb_$(date +%F).sql.gz
```

---

## 6. Restore

```bash
sudo bash /home/mkadmin/mkbaliadanga/scripts/restore.sh /path/to/backup.sql.gz
```

ম্যানুয়াল:
```bash
gunzip -c backup.sql.gz | docker exec -i mkb_postgres psql -U mkb_user -d mkbaliadanga
```

---

## 7. Quick SQL Examples

```bash
# Total users
docker exec mkb_postgres psql -U mkb_user -d mkbaliadanga -c "SELECT COUNT(*) FROM users;"

# Export টেবিল CSV
docker exec mkb_postgres psql -U mkb_user -d mkbaliadanga \
  -c "COPY users TO STDOUT WITH CSV HEADER" > users.csv

# Reset admin password (bcrypt hash 'Admin@123456')
docker exec mkb_app php artisan tinker --execute="\App\Models\User::where('email','ismailsagor162@gmail.com')->update(['password'=>bcrypt('Admin@123456')]);"
```

---

## 8. Health Check

```bash
docker ps                                              # সব container up?
docker exec mkb_postgres pg_isready -U mkb_user        # DB alive?
docker logs mkb_app --tail 50                          # app log
docker logs mkb_postgres --tail 50                     # db log
sudo bash /home/mkadmin/mkbaliadanga/scripts/healthcheck.sh
```

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| `mkb_postgres` not running | `cd /home/mkadmin/mkbaliadanga/backend && docker compose up -d` |
| Migration fail "table exists" | `docker exec mkb_app php artisan migrate:status` → manually fix |
| Password ভুলে গেছেন | `cat /root/mkbaliadanga-credentials.txt` |
| pgAdmin খুলছে না | `docker logs mkb_pgadmin` / firewall: `sudo ufw allow 5050/tcp` |
| Disk full | `docker system prune -af` + পুরাতন ব্যাকআপ মুছুন |

---

## 10. Manual pgAdmin Install (যদি install.sh এ skip করা হয়)

```bash
docker run -d --name mkb_pgadmin --restart unless-stopped \
  --network backend_default \
  -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=ismailsagor162@gmail.com \
  -e PGADMIN_DEFAULT_PASSWORD=Admin@123456 \
  -e PGADMIN_CONFIG_SERVER_MODE=False \
  dpage/pgadmin4:latest
sudo ufw allow 5050/tcp
```
