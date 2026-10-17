BEGIN;
-- Preserve historical communities and their posts; only the catalog changes.
INSERT INTO public.comunidades (id, nombre, titulo, genero, descripcion, portada_url)
VALUES
  ('pop', '@pop', 'Pop', 'pop', 'Charlas, lanzamientos, preguntas y recomendaciones para la escena pop de SONDAR.', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80'),
  ('rock', '@rock', 'Rock', 'rock', 'Guitarras, fechas, bandas nuevas, demos y conversaciones de la comunidad rock.', 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1400&q=80'),
  ('metal', '@metal', 'Metal', 'metal', 'Riffs pesados, fechas, discos, bandas emergentes y comunidad metalera.', 'https://images.unsplash.com/photo-1508252592163-5d3c3c5599ab?auto=format&fit=crop&w=1400&q=80'),
  ('urbano', '@urbano', 'Urbano', 'urbano', 'Beats, artistas, lanzamientos y encuentros de la escena urbana.', 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=80'),
  ('jazz', '@jazz', 'Jazz', 'jazz', 'Improvisacion, standards, jams, discos y encuentros para oyentes y musicos de jazz.', 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1400&q=80'),
  ('blues', '@blues', 'Blues', 'blues', 'Riffs, armonicas, zapadas, fechas y recomendaciones para quienes siguen el blues.', 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=80'),
  ('funk', '@funk', 'Funk', 'funk', 'Groove, bajos, bandas, lanzamientos y encuentros de la escena funk.', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80'),
  ('folklore', '@folklore', 'Folklore', 'folklore', 'Peñas, canciones, instrumentos, festivales y relatos de la escena folklorica.', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1400&q=80')
ON CONFLICT (id) DO UPDATE SET activa = true;
UPDATE public.comunidades SET activa = false WHERE genero NOT IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'folklore');
-- NOT VALID preserves historical preferences while enforcing the new catalog on new writes.
ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_valido;
ALTER TABLE public.user_genre_preferences DROP CONSTRAINT IF EXISTS user_genre_preferences_genero_check;
ALTER TABLE public.user_genre_preferences ADD CONSTRAINT user_genre_preferences_genero_check CHECK (genero IN ('pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'folklore')) NOT VALID;
COMMIT;
