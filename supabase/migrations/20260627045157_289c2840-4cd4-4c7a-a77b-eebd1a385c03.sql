INSERT INTO public.land_types (code, name, name_en, name_bn, sort_order, is_active) VALUES
  ('vorti_fee','Bharti Fee','Bharti Fee','ভর্তি ফি',5, true),
  ('bighat','Bighat','Bighat','বিঘাত',6, true),
  ('shobji','Vegetable','Vegetable','সবজি',7, true),
  ('bagan','Garden','Garden','বাগান',8, true),
  ('other','Other','Other','অন্যান্য',9, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  name_bn = EXCLUDED.name_bn,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  deleted_at = NULL;