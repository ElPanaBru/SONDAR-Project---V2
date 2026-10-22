-- Catalogo actual. Las migraciones gestionan referencias y retiros.
BEGIN;
INSERT INTO public.generos (slug, nombre, activo, orden)
VALUES
  ('pop', 'Pop', true, 1),
  ('rock', 'Rock', true, 2),
  ('urbano', 'Urbano', true, 3),
  ('jazz', 'Jazz', true, 4),
  ('blues', 'Blues', true, 5),
  ('funk', 'Funk', true, 6),
  ('folklore', 'Folklore', true, 7)
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre, activo = EXCLUDED.activo, orden = EXCLUDED.orden;
COMMIT;
