-- SOLO sobre una COPIA restaurada y respaldada. No ejecutado por esta auditoria.

-- Retira 4 tablas (incluyen datos historicos), 1 columna y 2 checks duplicados.

-- No usar 01 antes: este archivo es para una restauracion completa del origen.

BEGIN;

SET LOCAL lock_timeout = '5s';

SET LOCAL search_path = public, extensions, gis, pg_catalog;

-- DROP sin CASCADE: una dependencia desconocida debe detener la operacion.

DROP TABLE IF EXISTS public.profile_community_comments;

DROP TABLE IF EXISTS public.profile_community_posts;

DROP TABLE IF EXISTS public.user_genre_preferences;

DROP TABLE IF EXISTS public.reel_saves;

ALTER TABLE public.user_settings DROP COLUMN IF EXISTS created_at;

DO $guard$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.follows'::regclass AND conname='follows_no_self' AND convalidated)
      OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_blocks'::regclass AND conname='user_blocks_different_users' AND convalidated) THEN
      RAISE EXCEPTION 'Faltan los checks validados que reemplazan a los duplicados';
    END IF;
  END $guard$;

ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_no_self_follow_chk;

ALTER TABLE public.user_blocks DROP CONSTRAINT IF EXISTS user_blocks_no_self_block_chk;

NOTIFY pgrst, 'reload schema';

COMMIT;
