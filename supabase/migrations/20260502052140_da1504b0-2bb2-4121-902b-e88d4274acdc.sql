UPDATE auth.users
SET encrypted_password = crypt('Admin@123', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = '33314b1c-bc30-45ce-a506-35d5b00976ef';