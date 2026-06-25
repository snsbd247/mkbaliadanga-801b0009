ALTER TABLE public.land_transfers DROP CONSTRAINT IF EXISTS land_transfers_transfer_type_check;
ALTER TABLE public.land_transfers ADD CONSTRAINT land_transfers_transfer_type_check
  CHECK (transfer_type = ANY (ARRAY['inheritance'::text, 'sale'::text, 'borga_transfer'::text, 'borga_return'::text, 'split'::text, 'other'::text]));