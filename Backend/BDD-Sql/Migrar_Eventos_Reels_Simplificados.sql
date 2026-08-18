-- Migracion de produccion para el contrato simplificado de eventos y reels.
-- Es transaccional, idempotente y conserva todas las filas y columnas heredadas.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

SELECT pg_advisory_xact_lock(
  hashtext('sondar:eventos-reels-simplificados:v1')
);

DO $$
BEGIN
  IF to_regclass('public.eventos') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla public.eventos';
  END IF;

  IF to_regclass('public.reels') IS NULL THEN
    RAISE EXCEPTION 'Falta la tabla public.reels';
  END IF;
END $$;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS color_principal text;

DO $$
BEGIN
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

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reels'
      AND column_name = 'album'
  ) THEN
    ALTER TABLE public.reels
      ALTER COLUMN album DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reels'
      AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE public.reels
      ALTER COLUMN descripcion DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.reels'::regclass
      AND conname = 'reels_color_principal_formato_check'
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_color_principal_formato_check
      CHECK (
        color_principal IS NULL
        OR color_principal ~ '^#[0-9a-fA-F]{6}$'
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.reels
  VALIDATE CONSTRAINT reels_color_principal_formato_check;

COMMIT;
