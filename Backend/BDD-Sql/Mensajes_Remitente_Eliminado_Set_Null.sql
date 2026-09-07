BEGIN;

-- Conserva el historial de mensajes cuando se elimina un usuario. PostgreSQL
-- reemplaza sender_id por NULL en lugar de bloquear la baja o borrar mensajes.
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- Falla de forma atomica si el esquema final no coincide con lo esperado.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.messages'::regclass
      AND attname = 'sender_id'
      AND attnotnull
  ) THEN
    RAISE EXCEPTION 'public.messages.sender_id continua siendo NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_sender_id_fkey'
      AND contype = 'f'
      AND confrelid = 'public.users'::regclass
      AND confdeltype = 'n'
  ) THEN
    RAISE EXCEPTION 'messages_sender_id_fkey no usa ON DELETE SET NULL hacia public.users';
  END IF;
END;
$$;

COMMIT;
