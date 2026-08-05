-- El backend crea y repara public.users despues de crear la cuenta en Supabase Auth.
-- Este trigger de INSERT en auth.users duplica ese trabajo y puede hacer que /auth/v1/signup
-- termine en "upstream request timeout".

BEGIN;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

COMMIT;
