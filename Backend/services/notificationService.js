const pool = require('../Pool_DB');

const PREFERENCIA_POR_TIPO = Object.freeze({
  reel_like: 'notificar_interacciones',
  reel_comment_like: 'notificar_interacciones',
  community_like: 'notificar_interacciones',
  community_comment_like: 'notificar_interacciones',
  reel_comment: 'notificar_comentarios',
  reel_reply: 'notificar_comentarios',
  community_comment: 'notificar_comentarios',
  community_reply: 'notificar_comentarios',
  follow: 'notificar_seguidores',
  new_reel: 'notificar_publicaciones',
  new_event: 'notificar_publicaciones',
  new_community_post: 'notificar_publicaciones',
  mention: 'notificar_menciones',
  event_coorganizer: 'notificar_menciones',
});

function nombreActor(user) {
  return user?.user_metadata?.name
    || user?.user_metadata?.username
    || user?.email?.split('@')[0]
    || 'Alguien';
}

async function crearNotificacion({
  userId,
  actorId,
  type,
  title,
  body = '',
  targetUrl = '',
  entityType = null,
  entityId = null,
  metadata = {},
  uniqueKey = null,
}, client = pool) {
  if (!userId || userId === actorId) return null;
  try {
    const columnaPreferencia = PREFERENCIA_POR_TIPO[type];
    const condicionPreferencia = columnaPreferencia
      ? `AND COALESCE((SELECT ${columnaPreferencia} FROM user_settings WHERE user_id = $1), true)`
      : '';
    const result = await client.query(
    `INSERT INTO notifications (
       user_id, actor_id, type, title, body, target_url,
       entity_type, entity_id, metadata, unique_key
     )
     SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10
     WHERE COALESCE(
       (SELECT actividad_cuenta FROM user_settings WHERE user_id = $1),
       true
     )
       ${condicionPreferencia}
       AND NOT EXISTS (
         SELECT 1 FROM notification_mutes
         WHERE user_id = $1 AND muted_user_id = $2
       )
     ON CONFLICT (unique_key) DO NOTHING
     RETURNING id`,
    [
      userId,
      actorId || null,
      type,
      String(title || '').slice(0, 120),
      String(body || '').slice(0, 500),
      targetUrl,
      entityType,
      entityId === null || entityId === undefined ? null : String(entityId),
      JSON.stringify(metadata || {}),
      uniqueKey,
    ]
  );

    return result.rows[0] || null;
  } catch (error) {
    console.error('No se pudo crear una notificacion:', error);
    return null;
  }
}

async function eliminarNotificacion(uniqueKey, client = pool) {
  if (!uniqueKey) return;
  try {
    await client.query('DELETE FROM notifications WHERE unique_key = $1', [uniqueKey]);
  } catch (error) {
    console.error('No se pudo eliminar una notificacion:', error);
  }
}

async function notificarSeguidores({
  actorId,
  type,
  title,
  body = '',
  targetUrl = '',
  entityType = null,
  entityId = null,
  uniquePrefix,
}, client = pool) {
  try {
    await client.query(
    `INSERT INTO notifications (
       user_id, actor_id, type, title, body, target_url,
       entity_type, entity_id, unique_key
     )
     SELECT
       f.follower_id, $1, $2, $3, $4, $5, $6, $7,
       concat($8, ':', f.follower_id::text)
     FROM follows f
     LEFT JOIN user_settings us ON us.user_id = f.follower_id
     WHERE f.following_id = $1
       AND f.follower_id <> $1
       AND COALESCE(us.actividad_cuenta, true)
       AND COALESCE(us.notificar_publicaciones, true)
       AND NOT EXISTS (
         SELECT 1 FROM notification_mutes nm
         WHERE nm.user_id = f.follower_id AND nm.muted_user_id = $1
       )
     ON CONFLICT (unique_key) DO NOTHING`,
    [actorId, type, title, body, targetUrl, entityType, entityId === null || entityId === undefined ? null : String(entityId), String(uniquePrefix || '')]
    );
  } catch (error) {
    console.error('No se pudo notificar a los seguidores:', error);
  }
}

async function notificarMenciones({
  texto,
  actorId,
  actorName,
  targetUrl,
  entityType,
  entityId,
}, client = pool) {
  const usernames = [...new Set(
    [...String(texto || '').matchAll(/@([a-zA-Z0-9_.-]{1,40})/g)]
      .map((coincidencia) => coincidencia[1].toLowerCase())
  )];
  if (usernames.length === 0) return;

  try {
    const usuarios = await client.query(
      'SELECT id, username FROM users WHERE lower(username) = ANY($1::text[])',
      [usernames]
    );

    await Promise.all(usuarios.rows.map((usuario) => crearNotificacion({
      userId: usuario.id,
      actorId,
      type: 'mention',
      title: `${actorName} te menciono`,
      body: 'Toca para ver la conversacion.',
      targetUrl,
      entityType,
      entityId,
      uniqueKey: `mention:${entityType}:${entityId}:${usuario.id}`,
    }, client)));
  } catch (error) {
    console.error('No se pudieron procesar las menciones:', error);
  }
}

module.exports = {
  crearNotificacion,
  eliminarNotificacion,
  nombreActor,
  notificarMenciones,
  notificarSeguidores,
};
