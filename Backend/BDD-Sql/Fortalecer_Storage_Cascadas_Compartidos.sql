-- Ejecutar una vez en Supabase SQL Editor antes de desplegar este cambio.
-- Agrega rutas de Storage, normaliza contadores y garantiza cascadas.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_img_path text;

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS img_path text;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS visitas integer NOT NULL DEFAULT 0;

-- Recupera la ruta de imagen de eventos antiguos cuando la URL publica conserva
-- el formato estandar de Supabase Storage.
UPDATE public.eventos
SET img_path = substring(img_url FROM '/object/public/eventos/(.+)$')
WHERE img_path IS NULL
  AND img_url LIKE '%/object/public/eventos/%';

-- Un compartido es unico por usuario y reel. No existe politica DELETE:
-- un usuario puede registrarlo una sola vez y no puede deshacerlo.
CREATE TABLE IF NOT EXISTS public.reel_shares (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reel_id bigint NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reel_shares_pkey PRIMARY KEY (user_id, reel_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_shares_reel_id
  ON public.reel_shares(reel_id);

ALTER TABLE public.reel_shares ENABLE ROW LEVEL SECURITY;

-- Las listas sociales no son publicas para visitantes anonimos.
DROP POLICY IF EXISTS follows_select_public ON public.follows;
DROP POLICY IF EXISTS follows_select_authenticated ON public.follows;
CREATE POLICY follows_select_authenticated ON public.follows
  FOR SELECT USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reel_shares'
      AND policyname = 'reel_shares_select_own'
  ) THEN
    CREATE POLICY reel_shares_select_own ON public.reel_shares
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reel_shares'
      AND policyname = 'reel_shares_insert_own'
  ) THEN
    CREATE POLICY reel_shares_insert_own ON public.reel_shares
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Corrige cualquier contador historico que haya quedado desincronizado.
UPDATE public.reels r
SET compartidos = (
  SELECT COUNT(*)::int
  FROM public.reel_shares rs
  WHERE rs.reel_id = r.id
);

-- Reinstala las claves foraneas conocidas con borrado en cascada.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.eventos DROP CONSTRAINT IF EXISTS eventos_creador_id_fkey;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reels DROP CONSTRAINT IF EXISTS reels_creador_id_fkey;
ALTER TABLE public.reels
  ADD CONSTRAINT reels_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE public.follows
  ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.reel_likes DROP CONSTRAINT IF EXISTS reel_likes_user_id_fkey;
ALTER TABLE public.reel_likes DROP CONSTRAINT IF EXISTS reel_likes_reel_id_fkey;
ALTER TABLE public.reel_likes
  ADD CONSTRAINT reel_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reel_likes_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;

ALTER TABLE public.reel_saves DROP CONSTRAINT IF EXISTS reel_saves_user_id_fkey;
ALTER TABLE public.reel_saves DROP CONSTRAINT IF EXISTS reel_saves_reel_id_fkey;
ALTER TABLE public.reel_saves
  ADD CONSTRAINT reel_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reel_saves_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;

ALTER TABLE public.reel_shares DROP CONSTRAINT IF EXISTS reel_shares_user_id_fkey;
ALTER TABLE public.reel_shares DROP CONSTRAINT IF EXISTS reel_shares_reel_id_fkey;
ALTER TABLE public.reel_shares
  ADD CONSTRAINT reel_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reel_shares_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;

ALTER TABLE public.event_saves DROP CONSTRAINT IF EXISTS event_saves_user_id_fkey;
ALTER TABLE public.event_saves DROP CONSTRAINT IF EXISTS event_saves_event_id_fkey;
ALTER TABLE public.event_saves
  ADD CONSTRAINT event_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT event_saves_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_reel_id_fkey;
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_user_id_fkey;
ALTER TABLE public.reel_comments DROP CONSTRAINT IF EXISTS reel_comments_parent_id_fkey;
ALTER TABLE public.reel_comments
  ADD CONSTRAINT reel_comments_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE,
  ADD CONSTRAINT reel_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reel_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.reel_comments(id) ON DELETE CASCADE;

ALTER TABLE public.reel_comment_likes DROP CONSTRAINT IF EXISTS reel_comment_likes_user_id_fkey;
ALTER TABLE public.reel_comment_likes DROP CONSTRAINT IF EXISTS reel_comment_likes_comment_id_fkey;
ALTER TABLE public.reel_comment_likes
  ADD CONSTRAINT reel_comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reel_comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.reel_comments(id) ON DELETE CASCADE;

-- Buckets publicos: las escrituras siguen pasando por el backend con service role.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('perfiles', 'perfiles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('eventos', 'eventos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('reels', 'reels', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
