-- Fecha de nacimiento privada para el onboarding posterior al registro.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS birth_date date;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_birth_date_min_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_birth_date_min_check
  CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');

DO $$
BEGIN
  IF to_regclass('public.user_interests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'user_interests' AND column_name = 'genre'
     ) THEN
    DROP TABLE public.user_interests;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_interests (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  genre text NOT NULL CHECK (genre IN ('pop', 'rock', 'trap', 'cumbia', 'edm', 'jazz', 'blues', 'metal', 'folklore')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, genre)
);

CREATE INDEX IF NOT EXISTS user_interests_genre_idx ON public.user_interests (genre, user_id);
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_interests_own ON public.user_interests;
CREATE POLICY user_interests_own ON public.user_interests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMIT;
