-- Restaura el tipo de cuenta esperado por el backend en instalaciones donde
-- public.users ya existia antes de ejecutar los esquemas actuales.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS user_type text;

UPDATE public.users u
SET user_type = a.raw_user_meta_data ->> 'user_type'
FROM auth.users a
WHERE a.id = u.id
  AND u.user_type IS NULL
  AND a.raw_user_meta_data ->> 'user_type' IN ('musico', 'organizador', 'admin');

UPDATE public.users
SET user_type = 'musico'
WHERE user_type IS NULL;

ALTER TABLE public.users
  ALTER COLUMN user_type SET DEFAULT 'musico',
  ALTER COLUMN user_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_user_type_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_user_type_check
      CHECK (user_type IN ('musico', 'organizador', 'admin'));
  END IF;
END $$;

COMMIT;
