-- Preferencia para recibir avisos de mensajes directos.
-- Migracion aditiva e idempotente.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS notificar_mensajes boolean NOT NULL DEFAULT true;
