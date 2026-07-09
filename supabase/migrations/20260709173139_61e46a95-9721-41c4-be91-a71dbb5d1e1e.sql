INSERT INTO public.accounts (code, name, name_bn, type, is_system, is_active)
VALUES
  ('IRR-INCOME', 'Irrigation Income', 'সেচ আয়', 'income', true, true),
  ('IRR-PREV-DUE', 'Previous Due Collection', 'পূর্বের বকেয়া আদায়', 'income', true, true),
  ('IRR-DELAY', 'Delay Fee Income', 'বিলম্ব ফি আয়', 'income', true, true),
  ('IRR-MAINT', 'Maintenance Charge Income', 'রক্ষণাবেক্ষণ চার্জ আয়', 'income', true, true),
  ('IRR-CANAL', 'Canal Charge Income', 'ক্যানেল চার্জ আয়', 'income', true, true)
ON CONFLICT (code) DO NOTHING;