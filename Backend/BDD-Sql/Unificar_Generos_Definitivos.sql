-- Ejecutar UNA VEZ, luego de revisar las equivalencias y respaldar la base.
-- No se ejecuta automaticamente desde la aplicacion.
-- Conserva contenido; fusiona etiquetas y membresias duplicadas.
BEGIN;
SELECT pg_advisory_xact_lock(71820941);
CREATE TEMP TABLE equivalencias_generos (anterior text PRIMARY KEY, nuevo text NOT NULL) ON COMMIT DROP;
INSERT INTO equivalencias_generos VALUES
  ('trap', 'urbano'),
  ('rap', 'urbano'),
  ('hip hop', 'urbano'),
  ('hip-hop', 'urbano'),
  ('reggaeton', 'urbano'),
  ('reggaetón', 'urbano'),
  ('cumbia', 'urbano'),
  ('latina', 'urbano'),
  ('punk', 'rock'),
  ('alternativo', 'rock'),
  ('edm', 'pop'),
  ('electronica', 'pop'),
  ('electrónica', 'pop'),
  ('soul', 'funk'),
  ('disco', 'funk'),
  ('ska', 'reggae'),
  ('otros', 'pop');
INSERT INTO public.generos (slug, nombre, activo, orden) VALUES
  ('pop', 'Pop', true, 1),
  ('rock', 'Rock', true, 2),
  ('metal', 'Metal', true, 3),
  ('urbano', 'Urbano', true, 4),
  ('jazz', 'Jazz', true, 5),
  ('blues', 'Blues', true, 6),
  ('funk', 'Funk', true, 7),
  ('reggae', 'Reggae', true, 8),
  ('folklore', 'Folklore', true, 9)
ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true, orden = EXCLUDED.orden;
UPDATE public.generos SET activo = false WHERE slug NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore');
DO $$ BEGIN
  IF to_regclass('public.user_interests') IS NOT NULL THEN
    ALTER TABLE public.user_interests DROP CONSTRAINT IF EXISTS user_interests_genre_check;
    DELETE FROM public.user_interests a USING public.user_interests b
    WHERE a.user_id = b.user_id AND a.ctid > b.ctid
      AND COALESCE((SELECT nuevo FROM equivalencias_generos WHERE anterior = a.genre), a.genre)
        = COALESCE((SELECT nuevo FROM equivalencias_generos WHERE anterior = b.genre), b.genre);
    UPDATE public.user_interests u SET genre = e.nuevo FROM equivalencias_generos e WHERE u.genre = e.anterior;
    ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_genre_check CHECK (genre IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore'));
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.evento_generos') IS NOT NULL THEN
    DELETE FROM public.evento_generos a USING public.evento_generos b
    WHERE a.event_id = b.event_id AND (a.posicion > b.posicion OR (a.posicion = b.posicion AND a.ctid > b.ctid))
      AND COALESCE((SELECT nuevo FROM equivalencias_generos WHERE anterior = a.genero), a.genero)
        = COALESCE((SELECT nuevo FROM equivalencias_generos WHERE anterior = b.genero), b.genero);
    UPDATE public.evento_generos g SET genero = e.nuevo FROM equivalencias_generos e WHERE g.genero = e.anterior;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.reel_generos') IS NOT NULL THEN
    DELETE FROM public.reel_generos a USING public.reel_generos b
    WHERE a.reel_id = b.reel_id AND (a.posicion > b.posicion OR (a.posicion = b.posicion AND a.ctid > b.ctid))
      AND COALESCE((SELECT nuevo FROM equivalencias_generos WHERE anterior = a.genero), a.genero)
        = COALESCE((SELECT nuevo FROM equivalencias_generos WHERE anterior = b.genero), b.genero);
    UPDATE public.reel_generos g SET genero = e.nuevo FROM equivalencias_generos e WHERE g.genero = e.anterior;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.eventos') IS NOT NULL THEN
    UPDATE public.eventos g SET genero = e.nuevo FROM equivalencias_generos e WHERE g.genero = e.anterior;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.reels') IS NOT NULL THEN
    UPDATE public.reels g SET genero = e.nuevo FROM equivalencias_generos e WHERE g.genero = e.anterior;
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.comunidades') IS NOT NULL THEN
    INSERT INTO public.comunidades (id, nombre, titulo, genero, descripcion, portada_url, activa) VALUES
      ('pop', '@pop', 'Pop', 'pop', 'Charlas, lanzamientos y recomendaciones de pop y sonidos electronicos.', NULL, true),
      ('rock', '@rock', 'Rock', 'rock', 'Guitarras, punk, propuestas alternativas y novedades de rock.', NULL, true),
      ('metal', '@metal', 'Metal', 'metal', 'Riffs pesados, bandas, discos y encuentros de metal.', NULL, true),
      ('urbano', '@urbano', 'Urbano', 'urbano', 'Rap, trap, reggaeton, cumbia y sonidos latinos en una misma comunidad.', NULL, true),
      ('jazz', '@jazz', 'Jazz', 'jazz', 'Improvisacion, jams, discos y encuentros de jazz.', NULL, true),
      ('blues', '@blues', 'Blues', 'blues', 'Riffs, armonicas, zapadas y recomendaciones de blues.', NULL, true),
      ('funk', '@funk', 'Funk', 'funk', 'Groove, bajo, soul, disco y novedades de funk.', NULL, true),
      ('reggae', '@reggae', 'Reggae', 'reggae', 'Riddims, dub, ska y encuentros de reggae.', NULL, true),
      ('folklore', '@folklore', 'Folklore', 'folklore', 'Penas, canciones, instrumentos y tradiciones del folklore.', NULL, true)
    ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, descripcion = EXCLUDED.descripcion, portada_url = NULL, activa = true;
    IF to_regclass('public.comunidad_publicaciones') IS NOT NULL THEN
      UPDATE public.comunidad_publicaciones p SET comunidad_id = e.nuevo FROM equivalencias_generos e WHERE p.comunidad_id = e.anterior;
    END IF;
    IF to_regclass('public.comunidad_miembros') IS NOT NULL THEN
      INSERT INTO public.comunidad_miembros (comunidad_id, user_id, nivel_notificaciones, created_at)
      SELECT e.nuevo, m.user_id, m.nivel_notificaciones, m.created_at
      FROM public.comunidad_miembros m JOIN equivalencias_generos e ON m.comunidad_id = e.anterior
      ORDER BY m.created_at
      ON CONFLICT (comunidad_id, user_id) DO NOTHING;
      DELETE FROM public.comunidad_miembros WHERE comunidad_id IN (SELECT anterior FROM equivalencias_generos);
    END IF;
    UPDATE public.comunidades SET activa = false WHERE genero NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore');
  END IF;
END $$;
DO $$ BEGIN
 IF to_regclass('public.user_genre_affinity') IS NOT NULL THEN
   INSERT INTO public.user_genre_affinity (user_id, genre, behavioral_score, listening_sessions, last_interaction_at)
   SELECT a.user_id, e.nuevo, SUM(a.behavioral_score), SUM(a.listening_sessions), MAX(a.last_interaction_at)
   FROM public.user_genre_affinity a JOIN equivalencias_generos e ON a.genre = e.anterior
   GROUP BY a.user_id, e.nuevo
   ON CONFLICT (user_id, genre) DO UPDATE SET
     behavioral_score = user_genre_affinity.behavioral_score + EXCLUDED.behavioral_score,
     listening_sessions = user_genre_affinity.listening_sessions + EXCLUDED.listening_sessions,
     last_interaction_at = GREATEST(user_genre_affinity.last_interaction_at, EXCLUDED.last_interaction_at);
   DELETE FROM public.user_genre_affinity WHERE genre IN (SELECT anterior FROM equivalencias_generos);
 END IF;
 IF to_regclass('public.user_genre_preferences') IS NOT NULL THEN
   ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_check;
   INSERT INTO public.user_genre_preferences (user_id, genero, peso, created_at, updated_at)
   SELECT p.user_id, e.nuevo, SUM(p.peso), MIN(p.created_at), MAX(p.updated_at)
   FROM public.user_genre_preferences p JOIN equivalencias_generos e ON p.genero = e.anterior
   GROUP BY p.user_id, e.nuevo
   ON CONFLICT (user_id, genero) DO UPDATE SET
     peso = user_genre_preferences.peso + EXCLUDED.peso,
     created_at = LEAST(user_genre_preferences.created_at, EXCLUDED.created_at),
     updated_at = GREATEST(user_genre_preferences.updated_at, EXCLUDED.updated_at);
   DELETE FROM public.user_genre_preferences WHERE genero IN (SELECT anterior FROM equivalencias_generos);
   ALTER TABLE public.user_genre_preferences ADD CONSTRAINT user_genre_preferences_genero_check CHECK (genero IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore'));
 END IF;
END $$;
-- Retirar las categorias antiguas despues de trasladar sus referencias.
-- Sin CASCADE: una referencia no prevista debe impedir el borrado.
DO $$ BEGIN
  IF to_regclass('public.comunidades') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.comunidad_publicaciones p JOIN public.comunidades c ON c.id = p.comunidad_id WHERE c.genero NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore')) THEN
      RAISE EXCEPTION 'Quedan publicaciones en categorias antiguas; revisar equivalencias';
    END IF;
    IF EXISTS (SELECT 1 FROM public.comunidad_miembros m JOIN public.comunidades c ON c.id = m.comunidad_id WHERE c.genero NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore')) THEN
      RAISE EXCEPTION 'Quedan miembros en categorias antiguas; revisar equivalencias';
    END IF;
    DELETE FROM public.comunidades WHERE genero NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore');
  END IF;
END $$;
DELETE FROM public.generos WHERE slug NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'reggae', 'folklore');
COMMIT;
