-- Storage bucket for monthly reconciliation reports (super-admin readable)
insert into storage.buckets (id, name, public)
values ('reconciliation-reports', 'reconciliation-reports', false)
on conflict (id) do nothing;

-- Policies: super_admin can read/write
create policy "super_admin read recon reports"
on storage.objects for select to authenticated
using (bucket_id = 'reconciliation-reports' and public.has_role(auth.uid(), 'super_admin'::public.app_role));

create policy "super_admin write recon reports"
on storage.objects for insert to authenticated
with check (bucket_id = 'reconciliation-reports' and public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- Add SMS templates for QR rotate / revoke (Bangla + English) on sms_settings
alter table public.sms_settings
  add column if not exists send_on_qr_rotate boolean not null default true,
  add column if not exists send_on_qr_revoke boolean not null default true,
  add column if not exists tpl_qr_rotate text not null default 'আপনার সদস্য কার্ডের নতুন কিউআর কোড ইস্যু হয়েছে। পুরাতন কার্ড {grace} ঘণ্টা পর বন্ধ হবে।',
  add column if not exists tpl_qr_revoke text not null default 'আপনার সদস্য কার্ডের কিউআর কোড বাতিল করা হয়েছে। নতুন কার্ডের জন্য অফিসে যোগাযোগ করুন।',
  add column if not exists tpl_qr_rotate_en text not null default 'Your membership card QR has been reissued. The old card stops working in {grace} hours.',
  add column if not exists tpl_qr_revoke_en text not null default 'Your membership card QR has been revoked. Please contact your office for a new card.';
