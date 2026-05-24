
CREATE OR REPLACE FUNCTION public.log_land_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  last_change timestamptz;
  yrs numeric;
  auto_remark text := '';
  changed jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  IF COALESCE(OLD.land_size,0) = COALESCE(NEW.land_size,0)
     AND COALESCE(OLD.dag_no,'') = COALESCE(NEW.dag_no,'')
     AND COALESCE(OLD.owner_type::text,'') = COALESCE(NEW.owner_type::text,'')
     AND COALESCE(OLD.owner_farmer_id::text,'') = COALESCE(NEW.owner_farmer_id::text,'')
     AND COALESCE(OLD.field_type::text,'') = COALESCE(NEW.field_type::text,'')
     AND COALESCE(OLD.mouza_id::text,'') = COALESCE(NEW.mouza_id::text,'') THEN
    RETURN NEW;
  END IF;

  SELECT MAX(created_at) INTO last_change FROM public.land_change_log WHERE land_id = NEW.id;
  IF last_change IS NOT NULL THEN
    yrs := EXTRACT(EPOCH FROM (now() - last_change)) / (60*60*24*365.0);
    IF yrs >= 2 THEN
      auto_remark := format('দীর্ঘ মেয়াদী পরিবর্তন (%s বছর পর) — ', round(yrs,1));
    END IF;
  ELSE
    -- Track first significant change too
    auto_remark := 'প্রথম রেকর্ডকৃত পরিবর্তন — ';
  END IF;

  IF OLD.land_size IS DISTINCT FROM NEW.land_size THEN
    auto_remark := auto_remark || format('জমির পরিমাণ %s→%s; ', OLD.land_size, NEW.land_size);
  END IF;
  IF OLD.dag_no IS DISTINCT FROM NEW.dag_no THEN
    auto_remark := auto_remark || format('দাগ %s→%s; ', COALESCE(OLD.dag_no,'—'), COALESCE(NEW.dag_no,'—'));
  END IF;
  IF OLD.owner_type IS DISTINCT FROM NEW.owner_type THEN
    auto_remark := auto_remark || format('মালিকানা %s→%s; ', OLD.owner_type, NEW.owner_type);
  END IF;
  IF OLD.owner_farmer_id IS DISTINCT FROM NEW.owner_farmer_id THEN
    auto_remark := auto_remark || 'মালিক পরিবর্তিত; ';
  END IF;
  IF OLD.field_type IS DISTINCT FROM NEW.field_type THEN
    auto_remark := auto_remark || format('জমির ধরন %s→%s; ', OLD.field_type, NEW.field_type);
  END IF;
  IF OLD.mouza_id IS DISTINCT FROM NEW.mouza_id THEN
    auto_remark := auto_remark || 'মৌজা পরিবর্তিত; ';
  END IF;

  INSERT INTO public.land_change_log (land_id, farmer_id, office_id, change_type, old_values, new_values, remarks, changed_by)
  VALUES (
    NEW.id, NEW.farmer_id, NEW.office_id, 'auto_update',
    jsonb_build_object('land_size',OLD.land_size,'dag_no',OLD.dag_no,'owner_type',OLD.owner_type,'owner_farmer_id',OLD.owner_farmer_id,'field_type',OLD.field_type,'mouza_id',OLD.mouza_id),
    jsonb_build_object('land_size',NEW.land_size,'dag_no',NEW.dag_no,'owner_type',NEW.owner_type,'owner_farmer_id',NEW.owner_farmer_id,'field_type',NEW.field_type,'mouza_id',NEW.mouza_id),
    rtrim(auto_remark, '; '),
    auth.uid()
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_land_change ON public.lands;
CREATE TRIGGER trg_log_land_change
  AFTER UPDATE ON public.lands
  FOR EACH ROW EXECUTE FUNCTION public.log_land_change();
