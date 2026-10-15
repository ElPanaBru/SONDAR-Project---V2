-- Retira Reggae solamente si no tiene contenido ni preferencias asociadas.
BEGIN;
SELECT pg_advisory_xact_lock(71820941);
-- Retira solo etiquetas secundarias cuando queda otro genero y el principal no es Reggae.
DELETE FROM public.evento_generos g USING public.eventos e
WHERE g.event_id = e.id AND g.genero = 'reggae' AND e.genero <> 'reggae'
  AND EXISTS (SELECT 1 FROM public.evento_generos otra WHERE otra.event_id = g.event_id AND otra.genero <> 'reggae');
DELETE FROM public.reel_generos g USING public.reels r
WHERE g.reel_id = r.id AND g.genero = 'reggae' AND r.genero <> 'reggae'
  AND EXISTS (SELECT 1 FROM public.reel_generos otra WHERE otra.reel_id = g.reel_id AND otra.genero <> 'reggae');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.eventos WHERE genero = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en eventos; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reels WHERE genero = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en reels; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.evento_generos WHERE genero = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en evento_generos; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reel_generos WHERE genero = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en reel_generos; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_interests WHERE genre = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en user_interests; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_genre_affinity WHERE genre = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en user_genre_affinity; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_genre_preferences WHERE genero = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en user_genre_preferences; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.comunidad_publicaciones WHERE comunidad_id = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en comunidad_publicaciones; reclasificar antes de retirarlo';
  END IF;
  IF EXISTS (SELECT 1 FROM public.comunidad_miembros WHERE comunidad_id = 'reggae') THEN
    RAISE EXCEPTION 'Reggae tiene referencias en comunidad_miembros; reclasificar antes de retirarlo';
  END IF;
END $$;
DELETE FROM public.comunidades WHERE genero = 'reggae';
DELETE FROM public.generos WHERE slug = 'reggae';
UPDATE public.generos SET orden = 8 WHERE slug = 'folklore';
ALTER TABLE public.user_interests DROP CONSTRAINT IF EXISTS user_interests_genre_check;
ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_genre_check CHECK (genre IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'folklore'));
ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_valido;
   ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_check;
ALTER TABLE public.user_genre_preferences ADD CONSTRAINT user_genre_preferences_genero_check CHECK (genero IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'folklore'));
COMMIT;
