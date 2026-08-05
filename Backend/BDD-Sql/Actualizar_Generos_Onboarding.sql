BEGIN;

ALTER TABLE public.user_interests
  DROP CONSTRAINT IF EXISTS user_interests_genre_check;

ALTER TABLE public.user_interests
  ADD CONSTRAINT user_interests_genre_check
  CHECK (genre IN ('pop', 'rock', 'trap', 'cumbia', 'edm', 'jazz', 'blues', 'metal', 'folklore', 'otros'));

COMMIT;
