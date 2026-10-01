BEGIN;

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
ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  activo = EXCLUDED.activo,
  orden = EXCLUDED.orden;