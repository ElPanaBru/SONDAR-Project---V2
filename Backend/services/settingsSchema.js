const pool = require('../Pool_DB');

async function asegurarEsquemaConfiguracion() {
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
      DROP COLUMN IF EXISTS newsletter
  `);
}

module.exports = { asegurarEsquemaConfiguracion };
