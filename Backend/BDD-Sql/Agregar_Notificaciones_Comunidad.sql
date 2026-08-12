BEGIN;

ALTER TABLE public.comunidad_miembros
  ADD COLUMN IF NOT EXISTS nivel_notificaciones text NOT NULL DEFAULT 'todas';

UPDATE public.comunidad_miembros
SET nivel_notificaciones = 'todas'
WHERE nivel_notificaciones IS NULL
   OR nivel_notificaciones NOT IN ('todas', 'relevantes', 'silenciadas');

ALTER TABLE public.comunidad_miembros
  DROP CONSTRAINT IF EXISTS comunidad_miembros_nivel_notificaciones_check;

ALTER TABLE public.comunidad_miembros
  ADD CONSTRAINT comunidad_miembros_nivel_notificaciones_check
  CHECK (nivel_notificaciones IN ('todas', 'relevantes', 'silenciadas'));

COMMENT ON COLUMN public.comunidad_miembros.nivel_notificaciones IS
  'Nivel elegido por el miembro: todas, relevantes o silenciadas.';

COMMIT;
