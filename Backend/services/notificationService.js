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
  profile_post_reply: 'notificar_comentarios',
  follow: 'notificar_seguidores',
  new_reel: 'notificar_publicaciones',
  new_event: 'notificar_publicaciones',
  new_community_post: 'notificar_publicaciones',
  profile_post: 'notificar_publicaciones',
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
  uniqueKey = null,
  communityId = null,
}, client = pool) {
  if (!userId || userId === actorId) return null;
  try {
    const columnaPreferencia = PREFERENCIA_POR_TIPO[type];
    const condicionPreferencia = columnaPreferencia
      ? `AND COALESCE((SELECT ${columnaPreferencia} FROM user_settings WHERE user_id = $1), true)`
      : '';
    const params = [
      userId,
      actorId || null,
      type,
      String(title || '').slice(0, 120),
      String(body || '').slice(0, 500),
      targetUrl,
      uniqueKey,
    ];
    const condicionComunidad = communityId
      ? `AND COALESCE((
          SELECT cm.nivel_notificaciones <> 'silenciadas'
          FROM comunidad_miembros cm
          WHERE cm.comunidad_id = $${params.push(communityId)}
            AND cm.user_id = $1
        ), true)`
      : '';
    const result = await client.query(
    `INSERT INTO notifications (
       user_id, actor_id, type, title, body, target_url, unique_key
     )
     SELECT $1, $2, $3, $4, $5, $6, $7
     WHERE COALESCE(
       (SELECT actividad_cuenta FROM user_settings WHERE user_id = $1),
       true
     )
       ${condicionPreferencia}
       ${condicionComunidad}
       AND NOT EXISTS (
         SELECT 1 FROM notification_mutes
         WHERE user_id = $1 AND muted_user_id = $2
       )
     ON CONFLICT (unique_key) DO NOTHING
     RETURNING id`,
    params
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
  uniquePrefix,
}, client = pool) {
  try {
    if (!actorId || !uniquePrefix) return 0;

    const seguidores = await client.query(
    `SELECT f.follower_id
     FROM follows f
     WHERE f.following_id = $1
       AND f.follower_id <> $1
       AND NOT EXISTS (
         SELECT 1 FROM notification_mutes nm
         WHERE nm.user_id = f.follower_id AND nm.muted_user_id = $1
       )`,
    [actorId]
    );

    const creadas = await Promise.all(seguidores.rows.map((seguidor) => crearNotificacion({
      userId: seguidor.follower_id,
      actorId,
      type,
      title,
      body,
      targetUrl,
      uniqueKey: `${uniquePrefix}:${seguidor.follower_id}`,
    }, client)));

    return creadas.filter(Boolean).length;
  } catch (error) {
    console.error('No se pudo notificar a los seguidores:', error);
    return 0;
  }
}

async function notificarMiembrosComunidad({
  comunidadId,
  actorId,
  type = 'new_community_post',
  title,
  body = '',
  targetUrl = '',
  uniquePrefix,
  nivel = 'todas',
}, client = pool) {
  try {
    if (!comunidadId || !actorId || !uniquePrefix) return 0;
    if (!['todas', 'relevantes'].includes(nivel)) return 0;

    const miembros = await client.query(
      `SELECT cm.user_id
       FROM comunidad_miembros cm
       WHERE cm.comunidad_id = $1
         AND cm.user_id <> $2
         AND COALESCE(cm.nivel_notificaciones, 'todas') = $3`,
      [comunidadId, actorId, nivel]
    );

    const creadas = await Promise.all(miembros.rows.map((miembro) => crearNotificacion({
      userId: miembro.user_id,
      actorId,
      type,
      title,
      body,
      targetUrl,
      uniqueKey: `${uniquePrefix}:${miembro.user_id}`,
    }, client)));

    return creadas.filter(Boolean).length;
  } catch (error) {
    console.error('No se pudo notificar a los miembros de la comunidad:', error);
    return 0;
  }
}

async function notificarMenciones({
  texto,
  actorId,
  actorName,
  targetUrl,
  entityType,
  entityId,
  communityId = null,
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
      communityId,
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
  notificarMiembrosComunidad,
  notificarMenciones,
  notificarSeguidores,
};
