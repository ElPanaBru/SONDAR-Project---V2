-- Ejecutar una vez en Supabase SQL Editor.
-- Preferencias persistentes de la pantalla Configuracion.

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  telefono text NOT NULL DEFAULT '' CHECK (length(telefono) <= 30),
  codigo_pais text NOT NULL DEFAULT '+54'
    CHECK (codigo_pais IN ('+54', '+55', '+56', '+598')),
  idioma text NOT NULL DEFAULT 'es' CHECK (idioma IN ('es', 'en', 'pt')),
  zona_horaria text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'
    CHECK (zona_horaria IN (
      'America/Argentina/Buenos_Aires',
      'America/Santiago',
      'America/Montevideo'
    )),
  actividad_cuenta boolean NOT NULL DEFAULT true,
  notificar_interacciones boolean NOT NULL DEFAULT true,
  notificar_comentarios boolean NOT NULL DEFAULT true,
  notificar_seguidores boolean NOT NULL DEFAULT true,
  notificar_publicaciones boolean NOT NULL DEFAULT true,
  notificar_menciones boolean NOT NULL DEFAULT true,
  reducir_movimiento boolean NOT NULL DEFAULT false,
  perfil_privado boolean NOT NULL DEFAULT false,
  mostrar_email boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Permite aplicar esta misma migracion sobre instalaciones que ya tenian la tabla.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS codigo_pais text NOT NULL DEFAULT '+54';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_codigo_pais_check'
      AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE public.user_settings
      ADD CONSTRAINT user_settings_codigo_pais_check
      CHECK (codigo_pais IN ('+54', '+55', '+56', '+598'));
  END IF;
END $$;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_insert_own ON public.user_settings;
CREATE POLICY user_settings_insert_own ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_update_own ON public.user_settings;
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_delete_own ON public.user_settings;
CREATE POLICY user_settings_delete_own ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Migra preferencias que ya existan en Auth metadata, sin pisar filas guardadas.
INSERT INTO public.user_settings (
  user_id, telefono, codigo_pais, idioma, zona_horaria, actividad_cuenta,
  notificar_interacciones, notificar_comentarios, notificar_seguidores,
  notificar_publicaciones, notificar_menciones, reducir_movimiento,
  perfil_privado, mostrar_email
)
SELECT
  u.id,
  left(COALESCE(a.raw_user_meta_data->'configuracion'->>'telefono', ''), 30),
  CASE WHEN a.raw_user_meta_data->'configuracion'->>'codigoPais' IN ('+54', '+55', '+56', '+598')
    THEN a.raw_user_meta_data->'configuracion'->>'codigoPais' ELSE '+54' END,
  CASE WHEN a.raw_user_meta_data->'configuracion'->>'idioma' IN ('es', 'en', 'pt')
    THEN a.raw_user_meta_data->'configuracion'->>'idioma' ELSE 'es' END,
  CASE WHEN a.raw_user_meta_data->'configuracion'->>'zonaHoraria' IN (
    'America/Argentina/Buenos_Aires', 'America/Santiago', 'America/Montevideo'
  ) THEN a.raw_user_meta_data->'configuracion'->>'zonaHoraria'
    ELSE 'America/Argentina/Buenos_Aires' END,
  CASE WHEN a.raw_user_meta_data->'configuracion'->>'actividadCuenta' IN ('true', 'false')
    THEN (a.raw_user_meta_data->'configuracion'->>'actividadCuenta')::boolean ELSE true END,
  true,
  true,
  true,
  true,
  true,
  false,
  CASE WHEN a.raw_user_meta_data->'configuracion'->>'perfilPrivado' IN ('true', 'false')
    THEN (a.raw_user_meta_data->'configuracion'->>'perfilPrivado')::boolean ELSE false END,
  CASE WHEN a.raw_user_meta_data->'configuracion'->>'mostrarEmail' IN ('true', 'false')
    THEN (a.raw_user_meta_data->'configuracion'->>'mostrarEmail')::boolean ELSE false END
FROM public.users u
JOIN auth.users a ON a.id = u.id
ON CONFLICT (user_id) DO NOTHING;
