
DO $$
DECLARE
  i int;
  fid uuid;
  off uuid;
  mz uuid;
  num_lands int;
  j int;
  bn_first text[] := ARRAY['মোঃ','আঃ','মোসাঃ','শ্রী','সৈয়দ','হাজী'];
  bn_name  text[] := ARRAY['রহিম','করিম','জলিল','সালাম','সিদ্দিক','হাসান','আলম','মজিদ','ইউসুফ','বশির','রফিক','ফারুক','মিলন','জাহিদ','সবুজ','রবিউল','শাহজাহান','মোস্তফা','বাবুল','খোকন'];
  en_name  text[] := ARRAY['Rahim','Karim','Jalil','Salam','Siddik','Hasan','Alam','Majid','Yusuf','Bashir','Rafiq','Faruk','Milon','Jahid','Sabuj','Rabiul','Shahjahan','Mostafa','Babul','Khokon'];
  surname  text[] := ARRAY['Mia','Hossain','Ali','Sheikh','Mondol','Pramanik','Sarkar','Khan','Talukder','Munshi'];
BEGIN
  FOR i IN 1..200 LOOP
    fid := gen_random_uuid();
    IF i <= 100 THEN
      off := '11111111-1111-1111-1111-111111111111';
      mz  := (ARRAY['a0000000-0000-0000-0000-000000001000','a0000000-0000-0000-0000-000000001002'])[1 + (i % 2)]::uuid;
    ELSE
      off := '22222222-2222-2222-2222-222222222222';
      mz  := (ARRAY['a0000000-0000-0000-0000-000000001001','a0000000-0000-0000-0000-000000001003'])[1 + (i % 2)]::uuid;
    END IF;

    INSERT INTO public.farmers (
      id, farmer_code, member_no, name_en, name_bn, father_name, mother_name,
      mobile, nid, address, division, district, upazila, post_office, village,
      division_id, district_id, upazila_id, office_id, status, is_voter,
      voter_number, account_number
    ) VALUES (
      fid,
      'F-' || lpad(i::text, 5, '0'),
      'M-' || lpad(i::text, 4, '0'),
      en_name[1 + (i % 20)] || ' ' || surname[1 + (i % 10)],
      bn_first[1 + (i % 6)] || ' ' || bn_name[1 + (i % 20)],
      'Father of farmer ' || i,
      'Mother of farmer ' || i,
      '+88017' || lpad((10000000 + i)::text, 8, '0'),
      lpad((1990000000000 + i)::text, 13, '0'),
      'Village-' || i || ', Singair, Manikganj',
      'Dhaka','Manikganj','Singair','Singair Sadar','Village-' || i,
      'a0000000-0000-0000-0000-000000000001',
      'a0000000-0000-0000-0000-000000000010',
      'a0000000-0000-0000-0000-000000000100',
      off, 'active', (i % 10) < 7,
      CASE WHEN (i % 10) < 7 THEN lpad(i::text, 8, '0') ELSE NULL END,
      lpad((100000000000::bigint + i)::text, 12, '0')
    );

    num_lands := 1 + (i % 3);
    FOR j IN 1..num_lands LOOP
      INSERT INTO public.lands (farmer_id, mouza_id, dag_no, land_size, owner_type, field_type, office_id, division_id, district_id, upazila_id)
      VALUES (
        fid, mz, 'DAG-' || i || '-' || j,
        round((0.5 + (random() * 4.5))::numeric, 2),
        CASE WHEN j = 1 THEN 'owner'::owner_type ELSE (ARRAY['owner','borgadar'])[1 + (j % 2)]::owner_type END,
        (ARRAY['high_land','medium_land','low_land'])[1 + ((i + j) % 3)]::field_type,
        off,
        'a0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000010',
        'a0000000-0000-0000-0000-000000000100'
      );
    END LOOP;

    INSERT INTO public.qr_tokens (farmer_id, token, expires_at)
    VALUES (fid, encode(gen_random_bytes(24), 'hex'), now() + interval '90 days');

    INSERT INTO public.shares (farmer_id, balance, office_id) VALUES (fid, 0, off);
  END LOOP;
END $$;
