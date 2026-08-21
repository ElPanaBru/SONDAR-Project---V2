-- Mantiene las comunidades alineadas con los generos disponibles en SONDAR.
-- "otros" se desactiva para conservar publicaciones y membresias historicas.
BEGIN;

INSERT INTO public.comunidades (id, nombre, titulo, genero, descripcion, portada_url, activa)
VALUES
  ('alternativo', '@alternativo', 'Alternativo', 'alternativo', 'Propuestas independientes, cruces de estilos, nuevos sonidos y conversaciones de la escena alternativa.', 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1400&q=80', true),
  ('punk', '@punk', 'Punk', 'punk', 'Bandas, fechas, discos, autogestion y debates de la comunidad punk de SONDAR.', 'https://images.unsplash.com/photo-1508252592163-5d3c3c5599ab?auto=format&fit=crop&w=1400&q=80', true),
  ('reggae', '@reggae', 'Reggae', 'reggae', 'Riddims, bandas, dub, cultura soundsystem, lanzamientos y encuentros de la escena reggae.', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80', true),
  ('latina', '@latina', 'Latina', 'latina', 'Salsa, bachata, merengue, sonidos urbanos y novedades de la musica latina.', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80', true)
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    titulo = EXCLUDED.titulo,
    genero = EXCLUDED.genero,
    descripcion = EXCLUDED.descripcion,
    portada_url = EXCLUDED.portada_url,
    activa = true;

UPDATE public.comunidades
SET activa = false
WHERE lower(id) = 'otros' OR lower(genero) = 'otros';

DO $$
DECLARE
  comunidades_nuevas_activas integer;
BEGIN
  SELECT COUNT(*)
  INTO comunidades_nuevas_activas
  FROM public.comunidades
  WHERE id IN ('alternativo', 'punk', 'reggae', 'latina')
    AND activa = true;

  IF comunidades_nuevas_activas <> 4 THEN
    RAISE EXCEPTION 'No se activaron todas las comunidades nuevas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.comunidades
    WHERE (lower(id) = 'otros' OR lower(genero) = 'otros')
      AND activa = true
  ) THEN
    RAISE EXCEPTION 'La comunidad otros continua activa';
  END IF;
END $$;

COMMIT;
