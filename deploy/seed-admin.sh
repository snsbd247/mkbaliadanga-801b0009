#!/usr/bin/env bash
# =============================================================================
# deploy/seed-admin.sh — create (idempotently) the first admin login user so the
# operator only has to open the browser and sign in. Safe to re-run.
#
# Uses ADMIN_EMAIL + ADMIN_PASSWORD from .env.production. If the user already
# exists, the password is reset to the current ADMIN_PASSWORD and the
# super_admin role is (re)granted.
# =============================================================================
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/common.sh"
load_env

[[ -n "${ADMIN_EMAIL:-}" ]]    || die "ADMIN_EMAIL not set in $ENV_FILE"
[[ -n "${ADMIN_PASSWORD:-}" ]] || die "ADMIN_PASSWORD not set in $ENV_FILE"

psql_db() { docker exec -i supabase-db psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" "$@"; }

log "Creating/refreshing admin login user (${ADMIN_EMAIL})…"

psql_db -q -v email="${ADMIN_EMAIL}" -v password="${ADMIN_PASSWORD}" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- psql variables (:'email') are NOT interpolated inside dollar-quoted ($$)
-- PL/pgSQL bodies, so stash them into session settings first and read them
-- back with current_setting() inside the DO block.
SELECT set_config('seed_admin.email', :'email', false);
SELECT set_config('seed_admin.password', :'password', false);

DO $$
DECLARE
  v_email text := current_setting('seed_admin.email');
  v_password text := current_setting('seed_admin.password');
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid, v_email,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
       SET encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_uid;
  END IF;

  -- Profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (v_uid, 'Administrator', v_email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = now();

  -- Super admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
SQL

ok "Admin user ready — sign in at https://${APP_DOMAIN} with ${ADMIN_EMAIL}"
