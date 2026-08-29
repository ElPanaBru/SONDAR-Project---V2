BEGIN;

-- La conversacion y sus mensajes forman parte del historial del participante
-- que conserva su cuenta. El UUID retenido no permite acceder a un perfil borrado.
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;
ALTER TABLE public.conversations
  ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.conversation_members
  DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS last_delivered_at timestamptz
  NOT NULL DEFAULT timezone('utc'::text, now());

UPDATE public.conversation_members
SET last_delivered_at = GREATEST(last_delivered_at, last_read_at);

-- Recupera el participante tecnico en conversaciones directas antiguas que
-- todavia existen pero perdieron un miembro por la cascada anterior.
INSERT INTO public.conversation_members (
  conversation_id,
  user_id,
  joined_at,
  last_read_at,
  last_delivered_at
)
SELECT
  c.id,
  participante.user_id,
  c.created_at,
  c.created_at,
  c.created_at
FROM public.conversations c
CROSS JOIN LATERAL (
  VALUES
    (split_part(c.direct_key, ':', 1)::uuid),
    (split_part(c.direct_key, ':', 2)::uuid)
) participante(user_id)
WHERE c.direct_key ~* '^[0-9a-f-]{36}:[0-9a-f-]{36}$'
ON CONFLICT (conversation_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.broadcast_conversation_read_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.last_delivered_at IS DISTINCT FROM NEW.last_delivered_at THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'user_id', NEW.user_id,
        'last_delivered_at', NEW.last_delivered_at
      ),
      'delivered',
      'conversation:' || NEW.conversation_id::text,
      true
    );
  END IF;

  IF OLD.last_read_at IS DISTINCT FROM NEW.last_read_at THEN
    PERFORM realtime.send(
      jsonb_build_object(
        'user_id', NEW.user_id,
        'last_read_at', NEW.last_read_at
      ),
      'read',
      'conversation:' || NEW.conversation_id::text,
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversation_members_broadcast_read ON public.conversation_members;
CREATE TRIGGER conversation_members_broadcast_read
AFTER UPDATE OF last_read_at, last_delivered_at ON public.conversation_members
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_conversation_read_change();

COMMIT;
