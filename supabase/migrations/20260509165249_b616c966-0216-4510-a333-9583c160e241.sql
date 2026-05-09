-- 1) Update existing farmer_code values: strip "F-" prefix, keep digits only and pad to 5
UPDATE public.farmers
SET farmer_code = lpad(regexp_replace(farmer_code, '^[A-Za-z]+-?', ''), 5, '0')
WHERE farmer_code IS NOT NULL
  AND farmer_code !~ '^[0-9]+$';

-- 2) Realign sequence past the largest existing numeric code
SELECT setval(
  'public.farmer_code_seq',
  GREATEST(
    (SELECT COALESCE(MAX(farmer_code::int), 0) FROM public.farmers WHERE farmer_code ~ '^[0-9]+$'),
    1
  )
);

-- 3) Replace the trigger function to generate plain 5-digit padded codes
CREATE OR REPLACE FUNCTION public.set_farmer_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  next_num int;
begin
  if new.farmer_code is null or new.farmer_code = '' then
    next_num := nextval('public.farmer_code_seq');
    new.farmer_code := lpad(next_num::text, 5, '0');
  else
    -- normalize any manually supplied value: strip alpha prefix like "F-" and pad to 5
    if new.farmer_code !~ '^[0-9]+$' then
      new.farmer_code := lpad(regexp_replace(new.farmer_code, '^[A-Za-z]+-?', ''), 5, '0');
    end if;
  end if;
  return new;
end;
$function$;