const { tablasDelSnapshot } = require('./catalogoSql');
const { GENEROS_MUSICALES } = require('../services/generos');

// Se permiten tablas y columnas propias. Las tablas legacy no son requisito de runtime.
const TABLAS_HISTORICAS = new Set(['profile_community_posts', 'profile_community_comments', 'user_genre_preferences']);
const COLUMNAS_REQUERIDAS = {
  users: ['id', 'email', 'username', 'user_type', 'display_name', 'bio', 'birth_date', 'profile_img_url', 'profile_img_path'],
  user_settings: ['user_id', 'idioma', 'codigo_pais', 'notificar_mensajes', 'reducir_movimiento'],
  eventos: ['id', 'genero', 'lugar', 'fecha', 'precio', 'link', 'creador_id', 'latitud', 'longitud', 'ubicacion_geog'],
  reels: ['id', 'titulo', 'genero', 'audio_url', 'audio_path', 'portada_url', 'color_principal', 'creador_id'],
  conversation_members: ['conversation_id', 'user_id', 'last_read_at', 'last_delivered_at'],
  messages: ['id', 'conversation_id', 'sender_id', 'body', 'deleted_at', 'reply_to_id'],
  reel_saves: ['user_id', 'reel_id'],
  comunidad_comentario_guardados: ['user_id', 'comentario_id'],
};

async function verificarContrato(client) {
  const tablas = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map(r => r.tablename);
  const columnas = (await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'")).rows;
  const esperadas = tablasDelSnapshot().filter(t => !TABLAS_HISTORICAS.has(t));
  const faltantes = esperadas.filter(t => !tablas.includes(t));
  const campos = new Set(columnas.map(c => `${c.table_name}.${c.column_name}`));
  const columnasFaltantes = Object.entries(COLUMNAS_REQUERIDAS).flatMap(([tabla, nombres]) => nombres.filter(n => !campos.has(`${tabla}.${n}`)).map(n => `${tabla}.${n}`));
  const generos = tablas.includes('generos')
    ? (await client.query('SELECT slug FROM public.generos WHERE activo ORDER BY orden')).rows.map(r => r.slug)
    : [];
  const catalogoCorrecto = JSON.stringify(generos) === JSON.stringify(GENEROS_MUSICALES);
  return {
    ok: !faltantes.length && !columnasFaltantes.length && catalogoCorrecto,
    tablasFaltantes: faltantes,
    columnasFaltantes,
    catalogoCorrecto,
    generos,
    tablasAdicionales: tablas.filter(t => !esperadas.includes(t) && !TABLAS_HISTORICAS.has(t)),
    tablasHistoricasPresentes: tablas.filter(t => TABLAS_HISTORICAS.has(t)),
  };
}

module.exports = { COLUMNAS_REQUERIDAS, TABLAS_HISTORICAS, verificarContrato };
