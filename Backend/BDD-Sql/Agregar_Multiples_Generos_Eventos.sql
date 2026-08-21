-- Permite asociar entre uno y tres generos ordenados a cada evento.
-- Conserva eventos.genero como genero principal para clientes anteriores.

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
  ('otros', 'Otros', true, 99)
ON CONFLICT (slug) DO UPDATE
SET nombre = EXCLUDED.nombre,
    activo = EXCLUDED.activo,
    orden = EXCLUDED.orden;

-- Preserva cualquier genero historico que no forme parte del catalogo activo.
INSERT INTO public.generos (slug, nombre, activo, orden)
SELECT DISTINCT
  lower(trim(e.genero)),
  initcap(lower(trim(e.genero))),
  false,
  100
FROM public.eventos e
WHERE e.genero IS NOT NULL
  AND trim(e.genero) <> ''
ON CONFLICT (slug) DO NOTHING;

UPDATE public.eventos
SET genero = CASE
  WHEN genero IS NULL OR trim(genero) = '' THEN 'otros'
  ELSE lower(trim(genero))
END;

ALTER TABLE public.eventos ALTER COLUMN genero SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.evento_generos (
  event_id bigint NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  genero text NOT NULL REFERENCES public.generos(slug),
  posicion smallint NOT NULL CHECK (posicion BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (event_id, genero),
  UNIQUE (event_id, posicion)
);

CREATE INDEX IF NOT EXISTS evento_generos_genero_event_idx
  ON public.evento_generos (genero, event_id);

INSERT INTO public.evento_generos (event_id, genero, posicion)
SELECT id, genero, 1
FROM public.eventos
ON CONFLICT DO NOTHING;

ALTER TABLE public.generos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_generos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generos_public_read ON public.generos;
CREATE POLICY generos_public_read ON public.generos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS evento_generos_public_read ON public.evento_generos;
CREATE POLICY evento_generos_public_read ON public.evento_generos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS evento_generos_owner_write ON public.evento_generos;
CREATE POLICY evento_generos_owner_write ON public.evento_generos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.eventos e
      WHERE e.id = event_id AND e.creador_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.eventos e
      WHERE e.id = event_id AND e.creador_id = auth.uid()
    )
  );

GRANT SELECT ON public.generos, public.evento_generos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.evento_generos TO authenticated;

COMMIT;
