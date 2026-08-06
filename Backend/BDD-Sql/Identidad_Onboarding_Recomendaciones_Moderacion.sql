-- Ejecutar en Supabase SQL Editor o con el script de migracion del backend.
-- Agrega el ultimo paso de perfil y preferencias para recomendaciones.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS artist_name text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS artist_bio text,
ADD COLUMN IF NOT EXISTS profile_img_url text,
ADD COLUMN IF NOT EXISTS profile_img_path text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.user_genre_preferences (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  genero text NOT NULL,
  peso integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_genre_preferences_pkey PRIMARY KEY (user_id, genero),
  CONSTRAINT user_genre_preferences_genero_valido
    CHECK (genero IN ('pop', 'rock', 'edm', 'jazz', 'blues', 'cumbia', 'trap', 'metal', 'folklore', 'otros'))
);

CREATE INDEX IF NOT EXISTS idx_user_genre_preferences_genero
  ON public.user_genre_preferences(genero);

ALTER TABLE public.user_genre_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_genre_preferences' AND policyname = 'user_genre_preferences_select_own'
  ) THEN
    CREATE POLICY user_genre_preferences_select_own ON public.user_genre_preferences
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_genre_preferences' AND policyname = 'user_genre_preferences_insert_own'
  ) THEN
    CREATE POLICY user_genre_preferences_insert_own ON public.user_genre_preferences
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_genre_preferences' AND policyname = 'user_genre_preferences_update_own'
  ) THEN
    CREATE POLICY user_genre_preferences_update_own ON public.user_genre_preferences
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_genre_preferences' AND policyname = 'user_genre_preferences_delete_own'
  ) THEN
    CREATE POLICY user_genre_preferences_delete_own ON public.user_genre_preferences
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
