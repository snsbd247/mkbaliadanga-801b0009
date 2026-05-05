
-- 1. Create default office and assign super admin
INSERT INTO public.offices (name, address, contact)
VALUES ('Baliadanga Cooperative Office', 'Baliadanga, Rajshahi', '01700000000')
RETURNING id;

UPDATE public.profiles 
SET office_id = (SELECT id FROM public.offices ORDER BY created_at LIMIT 1)
WHERE office_id IS NULL;

-- 2. Recreate views with security_invoker (not SECURITY DEFINER)
DROP VIEW IF EXISTS public.farmer_savings_balance;
CREATE VIEW public.farmer_savings_balance
WITH (security_invoker=on) AS
SELECT f.id AS farmer_id,
  COALESCE(sum(CASE WHEN s.type='deposit'::savings_txn_type AND s.status='approved'::approval_status THEN s.amount END), 0) AS total_deposit,
  COALESCE(sum(CASE WHEN s.type='withdraw'::savings_txn_type AND s.status='approved'::approval_status THEN s.amount END), 0) AS total_withdraw,
  COALESCE(sum(CASE WHEN s.type='deposit'::savings_txn_type AND s.status='approved'::approval_status THEN s.amount END), 0)
  - COALESCE(sum(CASE WHEN s.type='withdraw'::savings_txn_type AND s.status='approved'::approval_status THEN s.amount END), 0) AS balance
FROM public.farmers f
LEFT JOIN public.savings_transactions s ON s.farmer_id = f.id
GROUP BY f.id;

DROP VIEW IF EXISTS public.lands_with_location;
CREATE VIEW public.lands_with_location
WITH (security_invoker=on) AS
SELECT id, farmer_id, mouza, dag_no, land_size, owner_type, field_type, created_at, office_id,
  NULL::uuid AS division_id, NULL::text AS division_name,
  NULL::uuid AS district_id, NULL::text AS district_name,
  NULL::uuid AS upazila_id, NULL::text AS upazila_name,
  mouza AS mouza_name
FROM public.lands;

DROP VIEW IF EXISTS public.ledger_entries_view;
CREATE VIEW public.ledger_entries_view
WITH (security_invoker=on) AS
SELECT le.id, le.entry_date, le.account_id, le.debit, le.credit, le.reference_type, le.reference_id,
  le.description, le.office_id, le.created_by, le.created_at,
  a.code AS account_code, a.name AS account_name, a.type AS account_type,
  o.name AS office_name
FROM public.ledger_entries le
LEFT JOIN public.accounts a ON a.id = le.account_id
LEFT JOIN public.offices o ON o.id = le.office_id;

-- 3. Deny-all policies on internal-only tables
DROP POLICY IF EXISTS "deny all" ON public.farmer_otps;
CREATE POLICY "deny all" ON public.farmer_otps FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny all" ON public.farmer_portal_sessions;
CREATE POLICY "deny all" ON public.farmer_portal_sessions FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 4. Fix search_path on trigger functions
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public._sms_render(text, jsonb) SET search_path = public;
ALTER FUNCTION public._sms_format_bdt(numeric) SET search_path = public;
