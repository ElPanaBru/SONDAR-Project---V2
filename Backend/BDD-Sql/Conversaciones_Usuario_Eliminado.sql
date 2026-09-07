BEGIN;

-- Conserva la conversacion y permite mostrar al otro participante como
-- "Usuario eliminado" cuando desaparece su perfil.
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;

ALTER TABLE public.conversations
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES public.users(id)
  ON DELETE SET NULL;

-- user_id forma parte de la clave primaria, por lo que no puede quedar en NULL.
-- Se conserva como identificador historico sin una FK al perfil eliminado.
ALTER TABLE public.conversation_members
  DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey;

-- Verifica el resultado antes de confirmar la transaccion.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.conversations'::regclass
      AND attname = 'created_by'
      AND attnotnull
  ) THEN
    RAISE EXCEPTION 'public.conversations.created_by continua siendo NOT NULL';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_created_by_fkey'
      AND contype = 'f'
      AND confrelid = 'public.users'::regclass
      AND confdeltype = 'n'
  ) THEN
    RAISE EXCEPTION 'conversations_created_by_fkey no usa ON DELETE SET NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_catalog = tc.constraint_catalog
     AND kcu.constraint_schema = tc.constraint_schema
     AND kcu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'conversation_members'
      AND kcu.column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'conversation_members.user_id todavia posee una clave foranea';
  END IF;
END;
$$;

COMMIT;
