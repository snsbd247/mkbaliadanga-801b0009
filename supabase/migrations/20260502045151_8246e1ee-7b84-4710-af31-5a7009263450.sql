
create or replace function public.is_committee_or_super(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('super_admin','committee')
  );
$$;
revoke execute on function public.is_committee_or_super(uuid) from anon, authenticated, public;

-- LOANS
drop policy if exists "admin delete loans" on public.loans;
create policy "committee delete loans" on public.loans for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update loans" on public.loans;
create policy "committee update loans" on public.loans for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- LOAN PAYMENTS
drop policy if exists "admin delete loan payments" on public.loan_payments;
create policy "committee delete loan payments" on public.loan_payments for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin manage loan payments" on public.loan_payments;
create policy "committee update loan payments" on public.loan_payments for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- SAVINGS
drop policy if exists "admin delete savings" on public.savings_transactions;
create policy "committee delete savings" on public.savings_transactions for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update savings" on public.savings_transactions;
create policy "committee update savings" on public.savings_transactions for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- PAYMENTS
drop policy if exists "admin delete payments" on public.payments;
create policy "committee delete payments" on public.payments for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update payments" on public.payments;
create policy "committee update payments" on public.payments for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- IRRIGATION
drop policy if exists "admin delete irrigation" on public.irrigation_charges;
create policy "committee delete irrigation" on public.irrigation_charges for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update irrigation" on public.irrigation_charges;
create policy "committee update irrigation" on public.irrigation_charges for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- EXPENSES
drop policy if exists "admin delete expenses" on public.expenses;
create policy "committee delete expenses" on public.expenses for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update expenses" on public.expenses;
create policy "committee update expenses" on public.expenses for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- RECEIPTS
drop policy if exists "admin delete receipts" on public.receipts;
create policy "committee delete receipts" on public.receipts for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update receipts" on public.receipts;
create policy "committee update receipts" on public.receipts for update to authenticated using (public.is_committee_or_super(auth.uid()));

-- ALLOCATIONS
drop policy if exists "admin delete allocations" on public.payment_allocations;
create policy "committee delete allocations" on public.payment_allocations for delete to authenticated using (public.is_committee_or_super(auth.uid()));
drop policy if exists "admin update allocations" on public.payment_allocations;
create policy "committee update allocations" on public.payment_allocations for update to authenticated using (public.is_committee_or_super(auth.uid()));
