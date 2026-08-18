-- Ejecutar en Supabase SQL Editor sobre el schema public.
-- Los eventos ya no tienen titulo/nombre ni descripcion. Las columnas se
-- conservan solo para compatibilidad con instalaciones anteriores, pero dejan
-- de ser obligatorias y los eventos nuevos almacenan NULL en ellas.

DO $$
BEGIN
  IF to_regclass('public.eventos') IS NULL THEN
    RETURN;
  END IF;

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

