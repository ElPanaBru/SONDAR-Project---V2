-- Migra la base SONDAR actual al modelo minimo usado por el backend.
-- IMPORTANTE: crear un respaldo y desplegar primero el backend actualizado.
-- Los contadores se eliminan porque ahora se calculan desde sus tablas de relacion.

BEGIN;

-- Consolidar perfil sin perder los valores actuales.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS profile_img_url text,
  ADD COLUMN IF NOT EXISTS profile_img_path text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

UPDATE public.users
SET display_name = COALESCE(
      NULLIF(trim(display_name), ''),
      NULLIF(trim(artist_name), ''),
      NULLIF(trim(full_name), ''),
      username
    ),
    bio = COALESCE(NULLIF(bio, ''), artist_bio, ''),
    profile_img_url = COALESCE(profile_img_url, profile_picture_url);

UPDATE public.users SET bio = '' WHERE bio IS NULL;

ALTER TABLE public.users
  ALTER COLUMN bio SET DEFAULT '',
  ALTER COLUMN bio SET NOT NULL,
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS artist_name,
  DROP COLUMN IF EXISTS artist_bio,
  DROP COLUMN IF EXISTS banner_url,
  DROP COLUMN IF EXISTS instagram_url,
  DROP COLUMN IF EXISTS verified,
  DROP COLUMN IF EXISTS profile_picture_url,
  DROP COLUMN IF EXISTS profile_picture_status,
  DROP COLUMN IF EXISTS telefono;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_birth_date_min_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_birth_date_min_check
  CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');

-- Configuracion: una sola tabla y una sola copia del telefono.
ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS permitir_mensajes,
  DROP COLUMN IF EXISTS login_alertas,
  DROP COLUMN IF EXISTS newsletter,
  DROP COLUMN IF EXISTS zona_horaria,
  DROP COLUMN IF EXISTS perfil_privado;

-- Las metricas se derivan de reel_likes/reel_saves/reel_shares/reel_views.
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS color_principal text,
  DROP COLUMN IF EXISTS likes,
  DROP COLUMN IF EXISTS compartidos,
  DROP COLUMN IF EXISTS guardados,
  DROP COLUMN IF EXISTS visitas,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS external_url;

-- Desactivar requisitos heredados sin borrar datos. El backend deja de
-- escribirlos en cuanto la base admite el contrato simplificado.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'album'
  ) THEN
    ALTER TABLE public.reels ALTER COLUMN album DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE public.reels ALTER COLUMN descripcion DROP NOT NULL;
  END IF;
END $$;

UPDATE public.reels
SET color_principal = NULL
WHERE color_principal IS NOT NULL
  AND color_principal !~ '^#[0-9a-fA-F]{6}$';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reels_color_principal_formato_check'
      AND conrelid = 'public.reels'::regclass
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_color_principal_formato_check
      CHECK (color_principal IS NULL OR color_principal ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.handle_reel_share_counter() CASCADE;

ALTER TABLE public.reel_comments
  DROP COLUMN IF EXISTS likes,
  DROP COLUMN IF EXISTS updated_at;

-- Las metricas de comunidad tambien se derivan de las relaciones.
ALTER TABLE public.comunidad_publicaciones
  DROP COLUMN IF EXISTS likes,
  DROP COLUMN IF EXISTS guardados,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.comunidad_comentarios
  DROP COLUMN IF EXISTS likes,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS updated_at;

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
END $$;

ALTER TABLE public.eventos
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS updated_at;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS entity_type,
  DROP COLUMN IF EXISTS entity_id,
  DROP COLUMN IF EXISTS metadata;

-- Modulos sin ninguna ruta o consulta activa en el proyecto.
DROP TABLE IF EXISTS public.settings;
DROP TABLE IF EXISTS public.event_attendance_events;
DROP TABLE IF EXISTS public.reel_listen_events;
DROP TABLE IF EXISTS public.content_moderation_alerts;

CREATE TABLE IF NOT EXISTS public.comunidad_miembros (
  comunidad_id text NOT NULL REFERENCES public.comunidades(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nivel_notificaciones text NOT NULL DEFAULT 'todas'
    CHECK (nivel_notificaciones IN ('todas', 'relevantes', 'silenciadas')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (comunidad_id, user_id)
);

ALTER TABLE public.comunidad_miembros
  ADD COLUMN IF NOT EXISTS nivel_notificaciones text NOT NULL DEFAULT 'todas';

CREATE INDEX IF NOT EXISTS comunidad_miembros_user_idx
  ON public.comunidad_miembros (user_id, created_at DESC);

DROP TABLE IF EXISTS public.user_interests;
CREATE TABLE public.user_interests (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  genre text NOT NULL CHECK (genre IN ('pop', 'rock', 'trap', 'cumbia', 'edm', 'jazz', 'blues', 'metal', 'folklore')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (user_id, genre)
);
CREATE INDEX user_interests_genre_idx ON public.user_interests (genre, user_id);
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_interests_own ON public.user_interests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TYPE IF EXISTS public.content_moderation_status;

-- El backend crea public.users despues de crear la cuenta en Auth.
-- No se usa trigger AFTER INSERT porque puede bloquear /auth/v1/signup.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.sync_auth_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email = COALESCE(NEW.email, NEW.id::text || '@sin-email.local'),
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.sync_auth_user_email();

-- Cerrar el acceso directo de PostgREST donde antes no se habia activado RLS.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_publicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_publicacion_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_publicacion_guardados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comunidad_comentario_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comunidad_miembros'
      AND policyname = 'comunidad_miembros_select_own'
  ) THEN
    CREATE POLICY comunidad_miembros_select_own ON public.comunidad_miembros
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comunidad_miembros'
      AND policyname = 'comunidad_miembros_own_write'
  ) THEN
    CREATE POLICY comunidad_miembros_own_write ON public.comunidad_miembros
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
