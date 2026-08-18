-- Migracion focalizada para aplicar en Supabase SQL Editor.
-- Es idempotente y no elimina los valores historicos de album/descripcion.

BEGIN;

ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS color_principal text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'album'
  ) THEN
    ALTER TABLE public.reels ALTER COLUMN album DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'descripcion'
  ) THEN
    ALTER TABLE public.reels ALTER COLUMN descripcion DROP NOT NULL;
  END IF;
END $$;

UPDATE public.reels
SET color_principal = NULL
WHERE color_principal IS NOT NULL
  AND color_principal !~ '^#[0-9a-fA-F]{6}$';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reels_color_principal_formato_check'
      AND conrelid = 'public.reels'::regclass
  ) THEN
    ALTER TABLE public.reels
      ADD CONSTRAINT reels_color_principal_formato_check
      CHECK (color_principal IS NULL OR color_principal ~ '^#[0-9a-fA-F]{6}$');
  END IF;
END $$;

COMMIT;
