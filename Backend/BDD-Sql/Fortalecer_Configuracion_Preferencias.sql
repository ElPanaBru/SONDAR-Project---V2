-- Preferencias reales de notificaciones y accesibilidad.
-- Elimina controles sin funcionalidad y agrega filtros usados por el backend.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notificar_interacciones boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificar_comentarios boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificar_seguidores boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificar_publicaciones boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificar_menciones boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reducir_movimiento boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS permitir_mensajes,
  DROP COLUMN IF EXISTS login_alertas,
  DROP COLUMN IF EXISTS newsletter;
