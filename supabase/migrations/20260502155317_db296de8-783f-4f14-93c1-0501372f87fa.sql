
-- =========================================================
-- STEP 1: Wipe transactional / demo data (preserve admin + settings + locations)
-- =========================================================
BEGIN;

DELETE FROM payment_allocations;
DELETE FROM payments;
DELETE FROM loan_payments;
DELETE FROM receipts;
DELETE FROM irrigation_charges;
DELETE FROM loans;
DELETE FROM savings_transactions;
DELETE FROM savings_yearly_opening;
DELETE FROM shares;
DELETE FROM journal_entry_lines;
DELETE FROM journal_entries;
DELETE FROM ledger_entries;
DELETE FROM expenses;
DELETE FROM notifications;
DELETE FROM sms_logs;
DELETE FROM audit_logs;
DELETE FROM farmer_rejections;
DELETE FROM qr_tokens;
DELETE FROM farmer_otps;
DELETE FROM farmer_portal_sessions;
DELETE FROM land_relations;
DELETE FROM lands;
DELETE FROM farmers;

COMMIT;

-- =========================================================
-- STEP 2: Top up villages for Rajshahi Division
-- Insert 2 villages per ward (idempotent via NOT EXISTS)
-- =========================================================
WITH raj AS (
  SELECT id FROM divisions WHERE name ILIKE 'Rajshahi' LIMIT 1
),
target_wards AS (
  SELECT w.id AS ward_id, w.union_id, w.name AS ward_name
  FROM wards w
  JOIN unions un ON un.id = w.union_id
  JOIN upazilas up ON up.id = un.upazila_id
  JOIN districts d ON d.id = up.district_id
  JOIN raj ON raj.id = d.division_id
),
seed AS (
  SELECT ward_id, union_id, ward_name, n
  FROM target_wards CROSS JOIN generate_series(1, 2) n
)
INSERT INTO villages (id, union_id, ward_id, name, name_bn, is_active)
SELECT gen_random_uuid(), s.union_id, s.ward_id,
       s.ward_name || ' Village ' || s.n,
       'গ্রাম ' || s.n,
       true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM villages v WHERE v.ward_id = s.ward_id AND v.name = s.ward_name || ' Village ' || s.n
);

-- Backfill ward_id on Rajshahi mouzas that have a union but no ward
UPDATE mouzas m
SET ward_id = sub.ward_id
FROM (
  SELECT DISTINCT ON (un.id) un.id AS union_id, w.id AS ward_id
  FROM unions un
  JOIN upazilas up ON up.id = un.upazila_id
  JOIN districts d ON d.id = up.district_id
  JOIN divisions dv ON dv.id = d.division_id
  JOIN wards w ON w.union_id = un.id
  WHERE dv.name ILIKE 'Rajshahi'
  ORDER BY un.id, w.created_at
) sub
WHERE m.union_id = sub.union_id AND m.ward_id IS NULL;
