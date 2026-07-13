GRANT EXECUTE ON FUNCTION public.merge_farmers(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';