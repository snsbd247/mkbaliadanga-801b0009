
-- ============================================================
-- STEP 1: FOUNDATIONS — Offices, Locations, Seasons, Accounts,
-- Loan/Savings Plans, Irrigation Rates, Receipt/Card settings
-- ============================================================

-- 1.1 Offices (2 branches)
INSERT INTO public.offices (id, name, address, registration_no, contact, established_on, payment_priority)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Mohammadkhani Branch', 'Mohammadkhani, Singair, Manikganj', 'REG-MK-2020-001', '+8801711111111', '2020-01-15', ARRAY['irrigation','loan','savings']),
  ('22222222-2222-2222-2222-222222222222', 'Baliadanga Branch',   'Baliadanga, Singair, Manikganj',   'REG-BD-2021-001', '+8801722222222', '2021-03-10', ARRAY['irrigation','loan','savings'])
ON CONFLICT (id) DO NOTHING;

-- 1.2 Divisions / Districts / Upazilas / Mouzas
INSERT INTO public.divisions (id, name, name_bn, code) VALUES
 ('a0000000-0000-0000-0000-000000000001','Dhaka','ঢাকা','DHK')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.districts (id, division_id, name, name_bn, code) VALUES
 ('a0000000-0000-0000-0000-000000000010','a0000000-0000-0000-0000-000000000001','Manikganj','মানিকগঞ্জ','MNK')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.upazilas (id, district_id, name, name_bn, code) VALUES
 ('a0000000-0000-0000-0000-000000000100','a0000000-0000-0000-0000-000000000010','Singair','সিংগাইর','SNG'),
 ('a0000000-0000-0000-0000-000000000101','a0000000-0000-0000-0000-000000000010','Saturia','সাটুরিয়া','SAT')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mouzas (id, upazila_id, name, name_bn, code) VALUES
 ('a0000000-0000-0000-0000-000000001000','a0000000-0000-0000-0000-000000000100','Mohammadkhani','মোহাম্মদখানী','MK01'),
 ('a0000000-0000-0000-0000-000000001001','a0000000-0000-0000-0000-000000000100','Baliadanga','বালিয়াডাঙ্গা','BD01'),
 ('a0000000-0000-0000-0000-000000001002','a0000000-0000-0000-0000-000000000100','Charigram','চারিগ্রাম','CG01'),
 ('a0000000-0000-0000-0000-000000001003','a0000000-0000-0000-0000-000000000101','Saturia Sadar','সাটুরিয়া সদর','SS01')
ON CONFLICT (id) DO NOTHING;

-- 1.3 Seasons (12 months coverage)
INSERT INTO public.seasons (id, year, type, name) VALUES
 ('b0000000-0000-0000-0000-000000000001', 2025, 'boro',  'Boro 2025'),
 ('b0000000-0000-0000-0000-000000000002', 2025, 'aman',  'Aman 2025'),
 ('b0000000-0000-0000-0000-000000000003', 2026, 'boro',  'Boro 2026')
ON CONFLICT DO NOTHING;

-- 1.4 Chart of Accounts
INSERT INTO public.accounts (id, code, name, name_bn, type, is_system) VALUES
 ('c0000000-0000-0000-0000-000000000001','1000','Cash in Hand','হাতে নগদ','asset',true),
 ('c0000000-0000-0000-0000-000000000002','1010','Bank Account','ব্যাংক হিসাব','asset',true),
 ('c0000000-0000-0000-0000-000000000003','1100','Loans Receivable','প্রদেয় ঋণ','asset',true),
 ('c0000000-0000-0000-0000-000000000004','1200','Irrigation Receivable','সেচ বকেয়া','asset',true),
 ('c0000000-0000-0000-0000-000000000005','2000','Members Savings','সদস্যের সঞ্চয়','liability',true),
 ('c0000000-0000-0000-0000-000000000006','2010','Members Shares','শেয়ার মূলধন','equity',true),
 ('c0000000-0000-0000-0000-000000000007','4000','Interest Income','সুদ আয়','income',true),
 ('c0000000-0000-0000-0000-000000000008','4010','Irrigation Income','সেচ আয়','income',true),
 ('c0000000-0000-0000-0000-000000000009','4020','Penalty Income','জরিমানা আয়','income',true),
 ('c0000000-0000-0000-0000-00000000000a','5000','Office Expense','অফিস খরচ','expense',false),
 ('c0000000-0000-0000-0000-00000000000b','5010','Salaries','বেতন','expense',false),
 ('c0000000-0000-0000-0000-00000000000c','5020','Maintenance','রক্ষণাবেক্ষণ','expense',false),
 ('c0000000-0000-0000-0000-00000000000d','5030','Utilities','বিদ্যুৎ ও পানি','expense',false)
ON CONFLICT (id) DO NOTHING;

-- 1.5 Loan Plans
INSERT INTO public.loan_plans (id, name, name_bn, duration_months, installment_type, interest_rate, penalty_type, penalty_value, grace_period_days, office_id) VALUES
 ('d0000000-0000-0000-0000-000000000001','6-Month Crop Loan','৬ মাস ফসল ঋণ',6,'monthly',10,'percentage',2,15,NULL),
 ('d0000000-0000-0000-0000-000000000002','12-Month Loan','১২ মাস ঋণ',12,'monthly',12,'percentage',2,30,NULL),
 ('d0000000-0000-0000-0000-000000000003','Weekly Micro Loan','সাপ্তাহিক মাইক্রো ঋণ',6,'weekly',8,'fixed',50,7,NULL)
ON CONFLICT (id) DO NOTHING;

-- 1.6 Savings Plans
INSERT INTO public.savings_plans (id, name, name_bn, duration_months, installment_type, installment_amount, interest_rate, maturity_type, office_id) VALUES
 ('e0000000-0000-0000-0000-000000000001','Monthly DPS 500','মাসিক ডিপিএস ৫০০',12,'monthly',500,8,'simple',NULL),
 ('e0000000-0000-0000-0000-000000000002','Monthly DPS 1000','মাসিক ডিপিএস ১০০০',12,'monthly',1000,8,'compound',NULL),
 ('e0000000-0000-0000-0000-000000000003','Daily Savings 50','দৈনিক সঞ্চয় ৫০',12,'daily',50,6,'simple',NULL)
ON CONFLICT (id) DO NOTHING;

-- 1.7 Irrigation Rates per office per season
INSERT INTO public.irrigation_rates (id, office_id, season_id, basis, base_rate, canal_charge, maintenance_charge, other_charge) VALUES
 ('f0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000001','per_size',1200,150,100,50),
 ('f0000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000002','per_size',900,120,80,40),
 ('f0000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','b0000000-0000-0000-0000-000000000003','per_size',1300,160,110,55),
 ('f0000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','per_size',1150,140,100,50),
 ('f0000000-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000002','per_size',880,110,80,40),
 ('f0000000-0000-0000-0000-000000000006','22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000003','per_size',1280,150,110,55)
ON CONFLICT (id) DO NOTHING;

-- 1.8 Company / Receipt / Card defaults (upsert on id=1)
INSERT INTO public.company_settings (id, company_name, company_name_bn, address, mobile, email, default_loan_interest)
VALUES (1, 'Smart Irrigation Cooperative', 'স্মার্ট সেচ সমবায় সমিতি', 'Singair, Manikganj', '+8801700000000', 'info@sicoop.bd', 10)
ON CONFLICT (id) DO UPDATE SET company_name_bn = EXCLUDED.company_name_bn, address = EXCLUDED.address;

INSERT INTO public.receipt_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.card_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
