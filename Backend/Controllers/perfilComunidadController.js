const pool = require('../Pool_DB');
const {
  crearNotificacion,
  nombreActor,
  notificarMenciones,
  notificarSeguidores,
} = require('../services/notificationService');

const LIMITE_PUBLICACION = 1000;
const LIMITE_RESPUESTA = 800;

function limpiarTexto(valor, limite) {
  return String(valor || '').trim().slice(0, limite);
}

function normalizarId(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapearAutor(row) {
  return {
    id: row.user_id,
    nombre: row.display_name || row.username || row.email?.split('@')[0] || 'Usuario SONDAR',
    usuario: row.username ? `@${row.username}` : '',
    avatar: row.profile_img_url || '',
  };
}

function mapearRespuesta(row) {
  return {
    id: Number(row.id),
    publicacionId: Number(row.publicacion_id),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    texto: row.texto,
    createdAt: row.created_at,
    autor: mapearAutor(row),
    respuestas: [],
  };
}

function anidarRespuestas(rows) {
  const respuestas = rows.map(mapearRespuesta);
  const porId = new Map(respuestas.map((respuesta) => [respuesta.id, respuesta]));
  const raices = [];

  for (const respuesta of respuestas) {
    const padre = respuesta.parentId ? porId.get(respuesta.parentId) : null;
    if (padre) padre.respuestas.push(respuesta);
    else raices.push(respuesta);
  }

  return raices;
}

function mapearPublicacion(row, respuestas = []) {
  const reel = row.reel_adjunto_id
    ? {
        id: Number(row.reel_adjunto_id),
        titulo: row.reel_titulo,
        genero: row.reel_genero || '',
        generos: Array.isArray(row.reel_generos) ? row.reel_generos : [],
        duracion: row.reel_duracion || '',
        portada: row.reel_portada_url || '',
        audio: row.reel_audio_url || '',
      }
    : null;
  const evento = row.evento_adjunto_id
    ? {
        id: Number(row.evento_adjunto_id),
        lugar: row.evento_lugar || '',
        fecha: row.evento_fecha,
        genero: row.evento_genero || '',
        generos: Array.isArray(row.evento_generos) ? row.evento_generos : [],
      }
    : null;

  return {
    id: Number(row.id),
    origen: row.origen,
    texto: row.texto,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    autor: mapearAutor(row),
    reel,
    evento,
    respuestas,
  };
}

const SELECT_PUBLICACION = `
  SELECT
    p.*,
    u.email,
    u.username,
    u.display_name,
    u.profile_img_url,
    r.id AS reel_adjunto_id,
    r.titulo AS reel_titulo,
    r.genero AS reel_genero,
    CASE
      WHEN r.id IS NULL THEN ARRAY[]::text[]
      ELSE COALESCE(
        (SELECT array_agg(rg.genero ORDER BY rg.posicion) FROM reel_generos rg WHERE rg.reel_id = r.id),
        ARRAY[r.genero]::text[]
      )
    END AS reel_generos,
    r.duracion AS reel_duracion,
    r.portada_url AS reel_portada_url,
    r.audio_url AS reel_audio_url,
    e.id AS evento_adjunto_id,
    e.lugar AS evento_lugar,
    e.fecha AS evento_fecha,
    e.genero AS evento_genero,
    CASE
      WHEN e.id IS NULL THEN ARRAY[]::text[]
      ELSE COALESCE(
        (SELECT array_agg(eg.genero ORDER BY eg.posicion) FROM evento_generos eg WHERE eg.event_id = e.id),
        ARRAY[e.genero]::text[]
      )
    END AS evento_generos
  FROM perfil_comunidad_publicaciones p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN reels r ON r.id = p.reel_id
  LEFT JOIN eventos e ON e.id = p.evento_id`;

async function buscarUsuario(identificador, client = pool) {
  const result = await client.query(
    `SELECT id, username, display_name, profile_img_url
     FROM users
     WHERE id::text = $1 OR lower(username) = lower($1)
     LIMIT 1`,
    [String(identificador || '').trim()]
  );
  return result.rows[0] || null;
}

async function obtenerPublicacion(publicacionId, client = pool) {
  const publicacionResult = await client.query(
    `${SELECT_PUBLICACION} WHERE p.id = $1`,
    [publicacionId]
  );
  if (publicacionResult.rowCount === 0) return null;

  const respuestasResult = await client.query(
    `SELECT pr.*, u.email, u.username, u.display_name, u.profile_img_url
     FROM perfil_comunidad_respuestas pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.publicacion_id = $1
     ORDER BY pr.created_at ASC, pr.id ASC`,
    [publicacionId]
  );

  return mapearPublicacion(publicacionResult.rows[0], anidarRespuestas(respuestasResult.rows));
}

async function puedeResponder(userId, propietarioId, client = pool) {
  if (!userId) return false;
  if (userId === propietarioId) return true;
  const result = await client.query(
    `SELECT EXISTS(
       SELECT 1 FROM follows
       WHERE follower_id = $1 AND following_id = $2
     ) AS permitido`,
    [userId, propietarioId]
  );
  return Boolean(result.rows[0]?.permitido);
}

const perfilComunidadController = {
  listarPublicaciones: async (req, res) => {
    try {
      const perfil = await buscarUsuario(req.params.identificador);
      if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado.' });

      if (req.user?.id && req.user.id !== perfil.id) {
        const bloqueo = await pool.query(
          `SELECT 1 FROM user_blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)`,
          [req.user.id, perfil.id]
        );
        if (bloqueo.rowCount > 0) {
          return res.status(403).json({ error: 'Este contenido no esta disponible.' });
        }
      }

      const publicacionesResult = await pool.query(
        `${SELECT_PUBLICACION}
         WHERE p.user_id = $1
         ORDER BY p.created_at DESC, p.id DESC`,
        [perfil.id]
      );
      const ids = publicacionesResult.rows.map((publicacion) => publicacion.id);
      const respuestasResult = ids.length > 0
        ? await pool.query(
          `SELECT pr.*, u.email, u.username, u.display_name, u.profile_img_url
           FROM perfil_comunidad_respuestas pr
           JOIN users u ON u.id = pr.user_id
           WHERE pr.publicacion_id = ANY($1::bigint[])
           ORDER BY pr.created_at ASC, pr.id ASC`,
          [ids]
        )
        : { rows: [] };
      const respuestasPorPublicacion = new Map();
      for (const respuesta of respuestasResult.rows) {
        const clave = String(respuesta.publicacion_id);
        if (!respuestasPorPublicacion.has(clave)) respuestasPorPublicacion.set(clave, []);
        respuestasPorPublicacion.get(clave).push(respuesta);
      }

      res.json({
        perfilId: perfil.id,
        puedePublicar: req.user?.id === perfil.id,
        puedeResponder: await puedeResponder(req.user?.id, perfil.id),
        publicaciones: publicacionesResult.rows.map((publicacion) => mapearPublicacion(
          publicacion,
          anidarRespuestas(respuestasPorPublicacion.get(String(publicacion.id)) || [])
        )),
      });
    } catch (error) {
      console.error('Error al listar la comunidad del perfil:', error);
      const status = error.code === '42P01' ? 503 : 500;
      res.status(status).json({ error: 'No se pudo cargar la comunidad del perfil.' });
    }
  },

  crearPublicacion: async (req, res) => {
    const texto = limpiarTexto(req.body?.texto, LIMITE_PUBLICACION);
    const reelId = normalizarId(req.body?.reelId);
    const eventoId = normalizarId(req.body?.eventoId);

    if (!texto) return res.status(400).json({ error: 'Escribi un mensaje para publicar.' });
    if (req.body?.reelId && !reelId) return res.status(400).json({ error: 'La preview adjunta no es valida.' });
    if (req.body?.eventoId && !eventoId) return res.status(400).json({ error: 'El evento adjunto no es valido.' });
    if (reelId && eventoId) return res.status(400).json({ error: 'Podes adjuntar una preview o un evento, no ambos.' });

    try {
      if (reelId) {
        const reel = await pool.query('SELECT 1 FROM reels WHERE id = $1 AND creador_id = $2', [reelId, req.user.id]);
        if (reel.rowCount === 0) return res.status(403).json({ error: 'Solo podes adjuntar una de tus previews.' });
      }
      if (eventoId) {
        const evento = await pool.query('SELECT 1 FROM eventos WHERE id = $1 AND creador_id = $2', [eventoId, req.user.id]);
        if (evento.rowCount === 0) return res.status(403).json({ error: 'Solo podes adjuntar uno de tus eventos.' });
      }

      const result = await pool.query(
        `INSERT INTO perfil_comunidad_publicaciones (user_id, origen, texto, reel_id, evento_id)
         VALUES ($1, 'manual', $2, $3, $4)
         RETURNING id`,
        [req.user.id, texto, reelId, eventoId]
      );
      const publicacion = await obtenerPublicacion(result.rows[0].id);
      const actorName = nombreActor(req.user);
      await notificarSeguidores({
        actorId: req.user.id,
        type: 'profile_post',
        title: `${actorName} publico en su comunidad`,
        body: texto,
        targetUrl: `/perfil/${req.user.id}?tab=comunidad&publicacion=${publicacion.id}`,
        uniquePrefix: `profile-post:${publicacion.id}`,
      });
      await notificarMenciones({
        texto,
        actorId: req.user.id,
        actorName,
        targetUrl: `/perfil/${req.user.id}?tab=comunidad&publicacion=${publicacion.id}`,
        entityType: 'profile_post',
        entityId: publicacion.id,
      });

      res.status(201).json(publicacion);
    } catch (error) {
      console.error('Error al crear una publicacion de perfil:', error);
      res.status(500).json({ error: 'No se pudo crear la publicacion.' });
    }
  },

  crearRespuesta: async (req, res) => {
    const publicacionId = normalizarId(req.params.publicacionId);
    const parentId = normalizarId(req.body?.parentId);
    const texto = limpiarTexto(req.body?.texto, LIMITE_RESPUESTA);
    if (!publicacionId) return res.status(400).json({ error: 'La publicacion no es valida.' });
    if (!texto) return res.status(400).json({ error: 'Escribi una respuesta.' });
    if (req.body?.parentId && !parentId) return res.status(400).json({ error: 'La respuesta citada no es valida.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const publicacionResult = await client.query(
        'SELECT id, user_id FROM perfil_comunidad_publicaciones WHERE id = $1',
        [publicacionId]
      );
      if (publicacionResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }
      const propietarioId = publicacionResult.rows[0].user_id;
      if (!(await puedeResponder(req.user.id, propietarioId, client))) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Solo los seguidores pueden responder en esta comunidad.' });
      }

      let autorRespuestaPadre = null;
      if (parentId) {
        const parentResult = await client.query(
          `SELECT user_id FROM perfil_comunidad_respuestas
           WHERE id = $1 AND publicacion_id = $2`,
          [parentId, publicacionId]
        );
        if (parentResult.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'La respuesta citada no pertenece a esta publicacion.' });
        }
        autorRespuestaPadre = parentResult.rows[0].user_id;
      }

      const result = await client.query(
        `INSERT INTO perfil_comunidad_respuestas (publicacion_id, user_id, parent_id, texto)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [publicacionId, req.user.id, parentId, texto]
      );
      const autorResult = await client.query(
        'SELECT email, username, display_name, profile_img_url FROM users WHERE id = $1',
        [req.user.id]
      );
      await client.query('COMMIT');

      const actorName = nombreActor(req.user);
      const targetUrlPropietario = `/perfil?tab=comunidad&publicacion=${publicacionId}`;
      await crearNotificacion({
        userId: propietarioId,
        actorId: req.user.id,
        type: 'profile_post_reply',
        title: `${actorName} respondio tu publicacion`,
        body: texto,
        targetUrl: targetUrlPropietario,
        uniqueKey: `profile-post-reply:${result.rows[0].id}:${propietarioId}`,
      });
      if (autorRespuestaPadre && autorRespuestaPadre !== propietarioId) {
        await crearNotificacion({
          userId: autorRespuestaPadre,
          actorId: req.user.id,
          type: 'profile_post_reply',
          title: `${actorName} respondio tu comentario`,
          body: texto,
          targetUrl: `/perfil/${propietarioId}?tab=comunidad&publicacion=${publicacionId}`,
          uniqueKey: `profile-post-reply:${result.rows[0].id}:${autorRespuestaPadre}`,
        });
      }
      await notificarMenciones({
        texto,
        actorId: req.user.id,
        actorName,
        targetUrl: `/perfil/${propietarioId}?tab=comunidad&publicacion=${publicacionId}`,
        entityType: 'profile_post_reply',
        entityId: result.rows[0].id,
      });

      res.status(201).json(mapearRespuesta({
        ...result.rows[0],
        ...autorResult.rows[0],
      }));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al responder en la comunidad del perfil:', error);
      res.status(500).json({ error: 'No se pudo guardar la respuesta.' });
    } finally {
      client.release();
    }
  },

  eliminarPublicacion: async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM perfil_comunidad_publicaciones
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [req.params.publicacionId, req.user.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Publicacion no encontrada o sin permiso.' });
      res.json({ ok: true, id: Number(result.rows[0].id) });
    } catch (error) {
      console.error('Error al eliminar una publicacion de perfil:', error);
      res.status(500).json({ error: 'No se pudo eliminar la publicacion.' });
    }
  },

  eliminarRespuesta: async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM perfil_comunidad_respuestas
         WHERE id = $1 AND user_id = $2
         RETURNING id, publicacion_id`,
        [req.params.respuestaId, req.user.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Respuesta no encontrada o sin permiso.' });
      res.json({
        ok: true,
        id: Number(result.rows[0].id),
        publicacionId: Number(result.rows[0].publicacion_id),
      });
    } catch (error) {
      console.error('Error al eliminar una respuesta de perfil:', error);
      res.status(500).json({ error: 'No se pudo eliminar la respuesta.' });
    }
  },
};

module.exports = perfilComunidadController;
