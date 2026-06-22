-- Ejecutar una vez en Supabase SQL Editor.
-- Garantiza un @ unico sin distinguir mayusculas y elimina preferencias retiradas.

WITH preparados AS (
  SELECT id, created_at,
         left(regexp_replace(regexp_replace(lower(username), '^@+', ''), '[^a-z0-9._-]', '', 'g'), 30) AS candidato
  FROM public.users
), clasificados AS (
  SELECT id, candidato,
         row_number() OVER (PARTITION BY candidato ORDER BY created_at, id) AS posicion
  FROM preparados
)
UPDATE public.users u
SET username = 'u_' || left(md5(u.id::text), 28)
FROM clasificados c
WHERE c.id = u.id AND (length(c.candidato) < 3 OR c.posicion > 1);

UPDATE public.users
SET username = left(
  regexp_replace(regexp_replace(lower(username), '^@+', ''), '[^a-z0-9._-]', '', 'g'),
  30
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
  ON public.users (lower(username));

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_username_formato_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_username_formato_check
  CHECK (username ~ '^[a-z0-9._-]{3,30}$');

ALTER TABLE public.user_settings
  DROP COLUMN IF EXISTS zona_horaria,
  DROP COLUMN IF EXISTS perfil_privado;

UPDATE auth.users AS a
SET raw_user_meta_data = jsonb_set(
      COALESCE(a.raw_user_meta_data, '{}'::jsonb),
      '{username}',
      to_jsonb(u.username),
      true
    )
  #- '{configuracion,zonaHoraria}'
  #- '{configuracion,perfilPrivado}'
FROM public.users u
WHERE a.id = u.id;
