CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users
SET encrypted_password = crypt('Admin@123', gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    updated_at = now()
WHERE id = '33314b1c-bc30-45ce-a506-35d5b00976ef';

CREATE TABLE IF NOT EXISTS public._pwcheck (id int primary key, ok boolean, hash text);
INSERT INTO public._pwcheck (id, ok, hash)
SELECT 1, encrypted_password = crypt('Admin@123', encrypted_password), encrypted_password
FROM auth.users WHERE id = '33314b1c-bc30-45ce-a506-35d5b00976ef'
ON CONFLICT (id) DO UPDATE SET ok = EXCLUDED.ok, hash = EXCLUDED.hash;