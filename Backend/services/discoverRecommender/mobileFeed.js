const { rankCandidates } = require('./recommend');
const { parseMusicGenres } = require('../genreService');

// Adaptador del esquema movil: conserva la puntuacion y diversificacion de web.
async function loadRecommendedReels(pool, viewerId, creatorId = null, options = {}) {
  const schema = (await pool.query(`
    SELECT to_regclass('public.reel_generos') IS NOT NULL AS multi_genre,
           to_regclass('public.user_genre_preferences') IS NOT NULL AS mobile_interests,
           to_regclass('public.user_interests') IS NOT NULL AS web_interests
  `)).rows[0] || {};
  const genreProjection = schema.multi_genre
    ? `COALESCE((SELECT array_agg(rg.genero ORDER BY rg.posicion) FROM reel_generos rg WHERE rg.reel_id = r.id), ARRAY[r.genero]::text[])`
    : 'ARRAY[r.genero]::text[]';
  const result = await pool.query(`
    SELECT r.*, ${genreProjection} AS generos,
           COALESCE(u.username, u.email) AS creador_nombre,
           u.email AS creador_email, u.profile_img_url AS creador_avatar,
           (SELECT count(*)::int FROM reel_comments rc WHERE rc.reel_id = r.id) AS comentarios_total,
           (SELECT count(*)::int FROM reel_likes rl WHERE rl.reel_id = r.id) AS likes_calculados,
           (SELECT count(*)::int FROM reel_saves rs WHERE rs.reel_id = r.id) AS guardados_calculados,
           (SELECT count(*)::int FROM reel_shares rs WHERE rs.reel_id = r.id) AS compartidos_calculados,
           (SELECT count(*)::int FROM reel_views rv WHERE rv.reel_id = r.id) AS visitas_calculadas
    FROM reels r LEFT JOIN users u ON u.id = r.creador_id
    WHERE ($1::uuid IS NULL OR NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_id = $1 AND ub.blocked_id = r.creador_id)
         OR (ub.blocker_id = r.creador_id AND ub.blocked_id = $1)
    )) AND ($2::uuid IS NULL OR r.creador_id = $2)
    ORDER BY r.created_at DESC, r.id DESC
  `, [viewerId, creatorId]);
  const candidates = result.rows.map(reel => ({
    ...reel,
    generos: parseMusicGenres(reel.generos?.length ? reel.generos : reel.genero),
  })).filter(reel => reel.generos.length);
  if (!candidates.length) return [];

  let signals = {};
  if (viewerId) {
    const [mobile, web, liked, saved, followed] = await Promise.all([
      schema.mobile_interests ? pool.query('SELECT genero FROM user_genre_preferences WHERE user_id = $1 ORDER BY peso DESC, created_at ASC', [viewerId]) : { rows: [] },
      schema.web_interests ? pool.query('SELECT genre FROM user_interests WHERE user_id = $1', [viewerId]) : { rows: [] },
      pool.query(`SELECT ${genreProjection} AS genres FROM reel_likes rl JOIN reels r ON r.id = rl.reel_id WHERE rl.user_id = $1 AND rl.created_at >= NOW() - INTERVAL '180 days' ORDER BY rl.created_at DESC LIMIT 500`, [viewerId]),
      pool.query(`SELECT ${genreProjection} AS genres FROM reel_saves rs JOIN reels r ON r.id = rs.reel_id WHERE rs.user_id = $1 AND rs.created_at >= NOW() - INTERVAL '180 days' ORDER BY rs.created_at DESC LIMIT 500`, [viewerId]),
      pool.query('SELECT following_id FROM follows WHERE follower_id = $1 ORDER BY created_at DESC LIMIT 500', [viewerId]),
    ]);
    // El onboarding movil es explicito y tiene prioridad si ambas tablas existen.
    signals = {
      interests: parseMusicGenres(mobile.rows.length ? mobile.rows.map(row => row.genero) : web.rows.map(row => row.genre)),
      liked: liked.rows.map(row => ({ genres: parseMusicGenres(row.genres) })),
      saved: saved.rows.map(row => ({ genres: parseMusicGenres(row.genres) })),
      followedCreatorIds: followed.rows.map(row => row.following_id),
    };
  }
  return rankCandidates(candidates, signals, options);
}

module.exports = { loadRecommendedReels };
