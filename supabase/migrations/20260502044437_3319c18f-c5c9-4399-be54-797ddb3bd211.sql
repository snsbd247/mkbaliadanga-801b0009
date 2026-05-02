
revoke execute on function public.get_previous_due(uuid,uuid,uuid) from anon, authenticated, public;
revoke execute on function public.compute_penalty(numeric,int) from anon, authenticated, public;
revoke execute on function public.fill_irrigation_arrears() from anon, authenticated, public;
