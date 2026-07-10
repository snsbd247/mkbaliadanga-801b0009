REVOKE EXECUTE ON FUNCTION public.admin_restore_begin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_restore_exec(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_restore_commit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_table_row_counts() FROM PUBLIC, anon;