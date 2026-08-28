-- Permite asociar entre uno y tres generos ordenados a cada reel.
-- Conserva reels.genero como genero principal para clientes anteriores.

BEGIN;

CREATE TABLE IF NOT EXISTS public.generos (
  slug text PRIMARY KEY,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  orden smallint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (length(trim(slug)) > 0),
  CHECK (length(trim(nombre)) > 0)
);

INSERT INTO public.generos (slug, nombre, activo, orden)
VALUES
  ('pop', 'Pop', true, 1),
  ('rock', 'Rock', true, 2),
  ('edm', 'Electronica', true, 3),
  ('jazz', 'Jazz', true, 4),
  ('blues', 'Blues', true, 5),
  ('cumbia', 'Cumbia', true, 6),
  ('trap', 'Urbano', true, 7),
  ('metal', 'Metal', true, 8),
  ('folklore', 'Folklore', true, 9),
  ('alternativo', 'Alternativo', true, 10),
  ('punk', 'Punk', true, 11),
  ('reggae', 'Reggae', true, 12),
  ('latina', 'Latina', true, 13),
  ('otros', 'Otros', true, 14)
ON CONFLICT (slug) DO UPDATE
SET nombre = EXCLUDED.nombre,
    activo = EXCLUDED.activo,
    orden = EXCLUDED.orden;

-- Preserva generos historicos antes de crear la clave foranea.
INSERT INTO public.generos (slug, nombre, activo, orden)
SELECT DISTINCT
  lower(trim(r.genero)),
  initcap(lower(trim(r.genero))),
  false,
  100
FROM public.reels r
WHERE r.genero IS NOT NULL
  AND trim(r.genero) <> ''
ON CONFLICT (slug) DO NOTHING;

UPDATE public.reels
SET genero = CASE
  WHEN genero IS NULL OR trim(genero) = '' THEN 'otros'
  ELSE lower(trim(genero))
END;

ALTER TABLE public.reels ALTER COLUMN genero SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.reel_generos (
  reel_id bigint NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  genero text NOT NULL REFERENCES public.generos(slug),
  posicion smallint NOT NULL CHECK (posicion BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (reel_id, genero),
  UNIQUE (reel_id, posicion)
);

CREATE INDEX IF NOT EXISTS reel_generos_genero_reel_idx
  ON public.reel_generos (genero, reel_id);

INSERT INTO public.reel_generos (reel_id, genero, posicion)
SELECT id, genero, 1
FROM public.reels
ON CONFLICT DO NOTHING;

ALTER TABLE public.generos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_generos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generos_public_read ON public.generos;
CREATE POLICY generos_public_read ON public.generos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS reel_generos_public_read ON public.reel_generos;
CREATE POLICY reel_generos_public_read ON public.reel_generos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS reel_generos_owner_write ON public.reel_generos;
CREATE POLICY reel_generos_owner_write ON public.reel_generos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.reels r
      WHERE r.id = reel_id AND r.creador_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reels r
      WHERE r.id = reel_id AND r.creador_id = auth.uid()
    )
  );

GRANT SELECT ON public.generos, public.reel_generos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reel_generos TO authenticated;

COMMIT;
