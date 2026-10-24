-- Conserva la recuperacion de cuentas de Ultime_Ver_Funcional en modo manual.
-- Cambio aditivo e idempotente: no programa ni elimina cuentas existentes.
BEGIN;
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;
COMMIT;
