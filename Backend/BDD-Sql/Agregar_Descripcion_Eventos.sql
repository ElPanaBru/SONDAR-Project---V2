-- Descripcion de eventos con soporte textual para menciones @usuario.
-- Idempotente: puede ejecutarse mas de una vez.

ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS descripcion text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'eventos_descripcion_length_check'
      AND conrelid = 'public.eventos'::regclass
  ) THEN
    ALTER TABLE public.eventos
      ADD CONSTRAINT eventos_descripcion_length_check
      CHECK (length(descripcion) <= 1000);
  END IF;
END $$;
