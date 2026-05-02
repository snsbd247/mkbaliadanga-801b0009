DO $$
DECLARE
  ok boolean;
BEGIN
  SELECT (encrypted_password = crypt('Admin@123', encrypted_password)) INTO ok
  FROM auth.users WHERE id = '33314b1c-bc30-45ce-a506-35d5b00976ef';
  RAISE NOTICE 'Password matches Admin@123: %', ok;
END $$;