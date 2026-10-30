-- Correccion hacia adelante: limpia el esquema y mantiene los contratos de la API.
-- Reaplica equivalencias conocidas si un seed antiguo reactivo categorias.
-- Metal se retira con su contenido por decision explicita; Reggae exige reclasificacion.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Ejecutar UNA VEZ, luego de revisar las equivalencias y respaldar la base.
-- No se ejecuta automaticamente desde la aplicacion.
-- Conserva contenido; fusiona etiquetas y membresias duplicadas.

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
   ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_valido;
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

-- Retiro de Metal con su contenido, solicitado expresamente.
-- Las FK ON DELETE CASCADE existentes retiran guardados, reacciones y respuestas.
CREATE TEMP TABLE eventos_metal ON COMMIT DROP AS
SELECT id FROM public.eventos WHERE genero = 'metal'
UNION SELECT event_id FROM public.evento_generos WHERE genero = 'metal';
CREATE TEMP TABLE reels_metal ON COMMIT DROP AS
SELECT id FROM public.reels WHERE genero = 'metal'
UNION SELECT reel_id FROM public.reel_generos WHERE genero = 'metal';
CREATE TEMP TABLE publicaciones_metal ON COMMIT DROP AS
SELECT id FROM public.comunidad_publicaciones
WHERE comunidad_id IN (SELECT id FROM public.comunidades WHERE genero = 'metal')
   OR evento_asociado_id IN (SELECT id::text FROM eventos_metal)
   OR reel_asociado_id IN (SELECT id::text FROM reels_metal);
CREATE TEMP TABLE posts_metal ON COMMIT DROP AS
SELECT id FROM public.perfil_comunidad_publicaciones
WHERE evento_id IN (SELECT id FROM eventos_metal) OR reel_id IN (SELECT id FROM reels_metal);
CREATE TEMP TABLE contenido_metal ON COMMIT DROP AS
SELECT 'evento'::text tipo, id::text id FROM eventos_metal
UNION ALL SELECT 'event', id::text FROM eventos_metal
UNION ALL SELECT 'reel', id::text FROM reels_metal
UNION ALL SELECT 'community_post', id::text FROM publicaciones_metal
UNION ALL SELECT 'profile_post', id::text FROM posts_metal
UNION ALL SELECT 'community_comment', id::text FROM public.comunidad_comentarios WHERE publicacion_id IN (SELECT id FROM publicaciones_metal)
UNION ALL SELECT 'profile_post_reply', id::text FROM public.perfil_comunidad_respuestas WHERE publicacion_id IN (SELECT id FROM posts_metal)
UNION ALL SELECT 'reel_comment', id::text FROM public.reel_comments WHERE reel_id IN (SELECT id FROM reels_metal);
DELETE FROM public.notifications n USING contenido_metal c WHERE n.entity_type=c.tipo AND n.entity_id=c.id;
DELETE FROM public.content_reports r USING contenido_metal c WHERE r.content_type=c.tipo AND r.content_id=c.id;
DELETE FROM public.comunidad_publicaciones
WHERE comunidad_id IN (SELECT id FROM public.comunidades WHERE genero = 'metal')
   OR evento_asociado_id IN (SELECT id::text FROM eventos_metal)
   OR reel_asociado_id IN (SELECT id::text FROM reels_metal);
DELETE FROM public.eventos WHERE id IN (SELECT id FROM eventos_metal);
DELETE FROM public.reels WHERE id IN (SELECT id FROM reels_metal);
DELETE FROM public.user_interests WHERE genre = 'metal';
DELETE FROM public.user_genre_affinity WHERE genre = 'metal';
DO $$ BEGIN
  IF to_regclass('public.user_genre_preferences') IS NOT NULL THEN
    DELETE FROM public.user_genre_preferences WHERE genero = 'metal';
  END IF;
END $$;
DELETE FROM public.comunidades WHERE genero = 'metal';
DELETE FROM public.generos WHERE slug = 'metal';

-- Retira categorias sin borrar el contenido asociado; cualquier referencia aborta.

SELECT pg_advisory_xact_lock(71820941);
DO $$ DECLARE genero_retirado text; BEGIN
 FOREACH genero_retirado IN ARRAY ARRAY['reggae'] LOOP
  IF EXISTS (SELECT 1 FROM public.eventos WHERE genero = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en eventos; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF EXISTS (SELECT 1 FROM public.reels WHERE genero = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en reels; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF EXISTS (SELECT 1 FROM public.evento_generos WHERE genero = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en evento_generos; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF EXISTS (SELECT 1 FROM public.reel_generos WHERE genero = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en reel_generos; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_interests WHERE genre = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en user_interests; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_genre_affinity WHERE genre = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en user_genre_affinity; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF to_regclass('public.user_genre_preferences') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_genre_preferences WHERE genero = genero_retirado) THEN
      RAISE EXCEPTION '% tiene referencias en user_genre_preferences; reclasificar antes de retirarlo', initcap(genero_retirado);
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.comunidad_publicaciones WHERE comunidad_id = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en comunidad_publicaciones; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
  IF EXISTS (SELECT 1 FROM public.comunidad_miembros WHERE comunidad_id = genero_retirado) THEN
    RAISE EXCEPTION '% tiene referencias en comunidad_miembros; reclasificar antes de retirarlo', initcap(genero_retirado);
  END IF;
 END LOOP;
END $$;
DELETE FROM public.comunidades WHERE genero IN ('reggae', 'metal');
DELETE FROM public.generos WHERE slug IN ('reggae', 'metal');
UPDATE public.generos g SET orden = c.orden FROM (VALUES ('pop',1),('rock',2),('urbano',3),('jazz',4),('blues',5),('funk',6),('folklore',7)) AS c(slug,orden) WHERE g.slug=c.slug;
ALTER TABLE public.user_interests DROP CONSTRAINT IF EXISTS user_interests_genre_check;
ALTER TABLE public.user_interests ADD CONSTRAINT user_interests_genre_check CHECK (genre IN ('pop', 'rock', 'urbano', 'jazz', 'blues', 'funk', 'folklore'));
DO $$ BEGIN
 IF to_regclass('public.user_genre_preferences') IS NOT NULL THEN
ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_valido;
   ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_check;
ALTER TABLE public.user_genre_preferences ADD CONSTRAINT user_genre_preferences_genero_check CHECK (genero IN ('pop', 'rock', 'urbano', 'jazz', 'blues', 'funk', 'folklore'));
 END IF;
END $$;

-- La politica consulta bloqueos mediante una funcion acotada: no expone user_blocks.
CREATE OR REPLACE FUNCTION public.puede_responder_perfil(publicacion_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.perfil_comunidad_publicaciones p
    WHERE p.id = publicacion_id
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.user_id)
           OR (b.blocker_id = p.user_id AND b.blocked_id = auth.uid())
      )
  );
$$;
REVOKE ALL ON FUNCTION public.puede_responder_perfil(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_responder_perfil(bigint) TO authenticated, service_role;
DROP POLICY IF EXISTS perfil_comunidad_respuestas_insert_follower ON public.perfil_comunidad_respuestas;
DROP POLICY IF EXISTS perfil_comunidad_respuestas_insert_authenticated ON public.perfil_comunidad_respuestas;
CREATE POLICY perfil_comunidad_respuestas_insert_authenticated
  ON public.perfil_comunidad_respuestas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.puede_responder_perfil(publicacion_id));

-- Migracion de produccion para el contrato simplificado de eventos y reels.
-- Es transaccional, idempotente y conserva todas las filas y columnas heredadas.


SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT pg_advisory_xact_lock(
  hashtext('sondar:eventos-reels-simplificados:v1')
);

DO $$
BEGIN
  IF to_regclass('public.eventos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla public.eventos';
  END IF;

  IF to_regclass('public.reels') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla public.reels';
  END IF;
END $$;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS color_principal text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'eventos'
      AND column_name = 'titulo'
  ) THEN
    ALTER TABLE public.eventos
      ALTER COLUMN titulo DROP NOT NULL,
      ALTER COLUMN titulo DROP DEFAULT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'eventos'
      AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE public.eventos
      ALTER COLUMN descripcion DROP NOT NULL,
      ALTER COLUMN descripcion DROP DEFAULT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reels'
      AND column_name = 'album'
  ) THEN
    ALTER TABLE public.reels
      ALTER COLUMN album DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reels'
      AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE public.reels
      ALTER COLUMN descripcion DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.reels'::regclass
      AND conname = 'reels_color_principal_formato_check'
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_color_principal_formato_check
      CHECK (
        color_principal IS NULL
        OR color_principal ~ '^#[0-9a-fA-F]{6}$'
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.reels
  VALIDATE CONSTRAINT reels_color_principal_formato_check;

-- Retirar exclusivamente las tablas reemplazadas y vacias. Sin CASCADE:
-- una dependencia personal o datos pendientes impiden la eliminacion.
DO $$
DECLARE tabla text; ocupada boolean;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['profile_community_comments', 'profile_community_posts', 'user_genre_preferences'] LOOP
    IF to_regclass('public.' || tabla) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', tabla);
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', tabla) INTO ocupada;
      IF ocupada THEN
        RAISE EXCEPTION 'La tabla historica % contiene datos; migrarlos antes de retirarla', tabla;
      END IF;
      EXECUTE format('DROP TABLE public.%I', tabla);
    END IF;
  END LOOP;
END $$;

COMMIT;
