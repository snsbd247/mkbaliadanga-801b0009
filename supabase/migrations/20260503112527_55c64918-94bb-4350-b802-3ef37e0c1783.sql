
-- Validation trigger: owner cannot equal tenant on land_relations
CREATE OR REPLACE FUNCTION public.validate_land_relation_owner_tenant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sharecropper_farmer_id IS NOT NULL AND NEW.sharecropper_farmer_id = NEW.owner_farmer_id THEN
    RAISE EXCEPTION 'Owner and Tenant must be different farmers';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_land_relation_owner_tenant ON public.land_relations;
CREATE TRIGGER trg_validate_land_relation_owner_tenant
BEFORE INSERT OR UPDATE ON public.land_relations
FOR EACH ROW EXECUTE FUNCTION public.validate_land_relation_owner_tenant();
