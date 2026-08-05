const pool = require('../Pool_DB');
const { asegurarEsquemaNotificaciones } = require('./notificationService');

async function asegurarEsquemaConfiguracion() {
  await asegurarEsquemaNotificaciones();

  await pool.query(`
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
    WHERE c.id = u.id AND (length(c.candidato) < 3 OR c.posicion > 1)
  `);

  await pool.query(`
    UPDATE public.users
    SET username = left(
      regexp_replace(regexp_replace(lower(username), '^@+', ''), '[^a-z0-9._-]', '', 'g'),
      30
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique
      ON public.users (lower(username))
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_username_formato_check'
          AND conrelid = 'public.users'::regclass
      ) THEN
        ALTER TABLE public.users
          ADD CONSTRAINT users_username_formato_check
          CHECK (username ~ '^[a-z0-9._-]{3,30}$');
      END IF;
    END $$
  `);

  await pool.query(`
    ALTER TABLE public.user_settings
      ADD COLUMN IF NOT EXISTS notificar_interacciones boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notificar_comentarios boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notificar_seguidores boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notificar_publicaciones boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notificar_menciones boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS reducir_movimiento boolean NOT NULL DEFAULT false
  `);

  await pool.query(`
    ALTER TABLE public.user_settings
      DROP COLUMN IF EXISTS permitir_mensajes,
      DROP COLUMN IF EXISTS login_alertas,
      DROP COLUMN IF EXISTS newsletter,
      DROP COLUMN IF EXISTS zona_horaria,
      DROP COLUMN IF EXISTS perfil_privado
  `);
}

module.exports = { asegurarEsquemaConfiguracion };
