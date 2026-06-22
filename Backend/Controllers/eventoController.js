const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const { subirImagenEvento, eliminarImagenEvento } = require('../services/storageService');
const {
  crearNotificacion,
  nombreActor,
  notificarSeguidores,
} = require('../services/notificationService');

async function obtenerViewerId(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function buscarAccesoEvento(eventoId, viewerId) {
  const result = await pool.query(
    `SELECT
       e.id,
       (
         COALESCE(us.perfil_privado, false) = false
         OR e.creador_id = $2
         OR EXISTS (
           SELECT 1 FROM event_organizers eo
           WHERE eo.event_id = e.id AND eo.user_id = $2
         )
         OR EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = e.creador_id AND f.following_id = $2
         )
       ) AS permitido
     FROM eventos e
     LEFT JOIN user_settings us ON us.user_id = e.creador_id
     WHERE e.id = $1`,
    [eventoId, viewerId]
  );
  return result.rows[0] || null;
}

function mapearEvento(evento) {
  if (!evento) return evento;

  return {
    ...evento,
    img: evento.img_url || null,
    creador: evento.creador || null
  };
}

async function asegurarUsuarioPublico(user) {
  const email = user.email || `${user.id}@sin-email.local`;
  const baseUsername =
    user.user_metadata?.username ||
    user.user_metadata?.name ||
    email.split('@')[0] ||
    'usuario';
  const username = `${baseUsername}`.trim().slice(0, 40) || 'usuario';
  const usernameSeguro = `${username}_${user.id.slice(0, 8)}`;

  await pool.query(
    `INSERT INTO users (id, email, username, user_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email
     RETURNING id`,
    [user.id, email, usernameSeguro, process.env.DEFAULT_USER_TYPE || 'musico']
  );
}

const eventoController = {
  listarEventos: async (req, res) => {
    try {
      const viewerId = await obtenerViewerId(req);
      const result = await pool.query(`
        SELECT
          e.*,
          e.img_url AS img,
          COALESCE(u.username, u.full_name, u.artist_name, 'Anonimo') AS creador,
          u.profile_img_url AS avatar,
          COALESCE(us.perfil_privado, false) AS creador_privado,
          COALESCE(org.organizadores, '[]'::jsonb) AS organizadores
        FROM eventos e
        LEFT JOIN users u ON u.id = e.creador_id
        LEFT JOIN user_settings us ON us.user_id = e.creador_id
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', co.id,
              'username', co.username,
              'nombre', COALESCE(co.artist_name, co.full_name, co.username),
              'avatar', COALESCE(co.profile_img_url, ''),
              'privado', COALESCE(cos.perfil_privado, false)
            )
            ORDER BY eo.created_at
          ) AS organizadores
          FROM event_organizers eo
          JOIN users co ON co.id = eo.user_id
          LEFT JOIN user_settings cos ON cos.user_id = co.id
          WHERE eo.event_id = e.id
        ) org ON true
        WHERE
          COALESCE(us.perfil_privado, false) = false
          OR e.creador_id = $1
          OR EXISTS (
            SELECT 1 FROM event_organizers acceso_org
            WHERE acceso_org.event_id = e.id AND acceso_org.user_id = $1
          )
          OR EXISTS (
            SELECT 1 FROM follows acceso
            WHERE acceso.follower_id = e.creador_id AND acceso.following_id = $1
          )
        ORDER BY e.id DESC
      `, [viewerId]);

      if (!viewerId || result.rows.length === 0) {
        return res.json(result.rows);
      }

      try {
        const guardados = await pool.query(
          'SELECT event_id FROM event_saves WHERE user_id = $1 AND event_id = ANY($2::bigint[])',
          [viewerId, result.rows.map((evento) => evento.id)]
        );
        const guardadoSet = new Set(guardados.rows.map((row) => String(row.event_id)));

        return res.json(result.rows.map((evento) => ({
          ...evento,
          guardado: guardadoSet.has(String(evento.id)),
        })));
      } catch (error) {
        if (error.code !== '42P01') throw error;
        return res.json(result.rows);
      }
    } catch (error) {
      console.error('Error al listar eventos:', error);
      res.status(500).json({ error: 'Error al obtener los eventos.' });
    }
  },

  crearEvento: async (req, res) => {
    const { titulo, descripcion, genero, ubicacion, fecha, precio, link, latitud, longitud, organizadores } = req.body;
    const creadorId = req.user.id;
    let imagenSubida = null;
    let dbClient = null;

    const creadorNombre =
      req.user?.user_metadata?.name ||
      req.user?.user_metadata?.username ||
      req.user?.email?.split('@')[0] ||
      'Anonimo';


    if (!titulo || !genero || !ubicacion || !fecha || !latitud || !longitud) {
      return res.status(400).json({ error: 'Faltan datos obligatorios del evento.' });
    }

    if (String(descripcion || '').length > 1000) {
      return res.status(400).json({ error: 'La descripcion no puede superar los 1000 caracteres.' });
    }

    let organizadorIds = [];
    try {
      const recibidos = organizadores ? JSON.parse(organizadores) : [];
      if (!Array.isArray(recibidos)) throw new Error('Formato invalido');
      organizadorIds = [...new Set(recibidos
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== creadorId))];
    } catch {
      return res.status(400).json({ error: 'La lista de organizadores no es valida.' });
    }

    if (organizadorIds.length > 8) {
      return res.status(400).json({ error: 'Podes agregar hasta 8 coorganizadores.' });
    }

    const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (organizadorIds.some((id) => !uuidValido.test(id))) {
      return res.status(400).json({ error: 'Hay un organizador invalido.' });
    }

    const precioNormalizado = precio === '' || precio === undefined ? null : Number(precio);

    if (precioNormalizado !== null && (!Number.isFinite(precioNormalizado) || precioNormalizado < 0)) {
      return res.status(400).json({ error: 'El precio de entrada no es valido.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);

      if (organizadorIds.length > 0) {
        const usuariosValidos = await pool.query(
          'SELECT id FROM users WHERE id = ANY($1::uuid[])',
          [organizadorIds]
        );
        if (usuariosValidos.rowCount !== organizadorIds.length) {
          return res.status(400).json({ error: 'Uno de los coorganizadores ya no esta disponible.' });
        }
      }

      imagenSubida = await subirImagenEvento(req.file);
      dbClient = await pool.connect();
      await dbClient.query('BEGIN');

      const query = `
        INSERT INTO eventos (titulo, descripcion, genero, lugar, fecha, img_url, img_path, precio, link, creador_id, latitud, longitud)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`;

      const values = [
        titulo,
        String(descripcion || '').trim(),
        genero,
        ubicacion,
        fecha,
        imagenSubida?.publicUrl || null,
        imagenSubida?.path || null,
        precioNormalizado,
        link || null,
        creadorId,
        latitud,
        longitud
      ];

      const result = await dbClient.query(query, values);

      if (organizadorIds.length > 0) {
        await dbClient.query(
          `INSERT INTO event_organizers (event_id, user_id, added_by)
           SELECT $1, unnest($2::uuid[]), $3`,
          [result.rows[0].id, organizadorIds, creadorId]
        );
      }

      const organizadoresResult = organizadorIds.length > 0
        ? await dbClient.query(
          `SELECT
             u.id,
             u.username,
             COALESCE(u.artist_name, u.full_name, u.username) AS nombre,
             COALESCE(u.profile_img_url, '') AS avatar,
             COALESCE(us.perfil_privado, false) AS privado
           FROM event_organizers eo
           JOIN users u ON u.id = eo.user_id
           LEFT JOIN user_settings us ON us.user_id = u.id
           WHERE eo.event_id = $1
           ORDER BY eo.created_at`,
          [result.rows[0].id]
        )
        : { rows: [] };
      const privacidad = await dbClient.query(
        'SELECT COALESCE(perfil_privado, false) AS creador_privado FROM user_settings WHERE user_id = $1',
        [creadorId]
      );

      const actorName = nombreActor(req.user);
      await notificarSeguidores({
        actorId: creadorId,
        type: 'new_event',
        title: `${actorName} creo un nuevo evento`,
        body: titulo,
        targetUrl: `/?evento=${result.rows[0].id}`,
        entityType: 'event',
        entityId: result.rows[0].id,
        uniquePrefix: `new-event:${result.rows[0].id}`,
      }, dbClient);

      for (const organizador of organizadoresResult.rows) {
        await crearNotificacion({
          userId: organizador.id,
          actorId: creadorId,
          type: 'event_coorganizer',
          title: `${actorName} te agrego como coorganizador`,
          body: titulo,
          targetUrl: `/?evento=${result.rows[0].id}`,
          entityType: 'event',
          entityId: result.rows[0].id,
          uniqueKey: `event-coorganizer:${result.rows[0].id}:${organizador.id}`,
        }, dbClient);
      }

      await dbClient.query('COMMIT');
      res.status(201).json(mapearEvento({
        ...result.rows[0],
        creador: creadorNombre,
        creador_privado: Boolean(privacidad.rows[0]?.creador_privado),
        organizadores: organizadoresResult.rows,
      }));
    } catch (error) {
      if (dbClient) await dbClient.query('ROLLBACK').catch(() => {});
      if (imagenSubida?.path) {
        await eliminarImagenEvento(imagenSubida.path);
      }

      console.error('Error al crear evento:', error);
      res.status(500).json({ error: error.message || 'Error al guardar el evento.' });
    } finally {
      dbClient?.release();
    }
  },

  eliminarEvento: async (req, res) => {
    const { id } = req.params;
    const creadorId = req.user.id;

    try {
      const result = await pool.query(
        'DELETE FROM eventos WHERE id = $1 AND creador_id = $2 RETURNING id, img_path',
        [id, creadorId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Evento no encontrado o sin permiso para eliminarlo.' });
      }

      await eliminarImagenEvento(result.rows[0].img_path).catch((error) => {
        console.error('No se pudo eliminar la imagen del evento:', error);
      });

      res.json({ ok: true, id: result.rows[0].id });
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      res.status(500).json({ error: 'No se pudo eliminar el evento.' });
    }
  },

  alternarGuardado: async (req, res) => {
    const { id } = req.params;

    try {
      await asegurarUsuarioPublico(req.user);

      const evento = await buscarAccesoEvento(id, req.user.id);
      if (!evento) {
        return res.status(404).json({ error: 'Evento no encontrado.' });
      }
      if (!evento.permitido) {
        return res.status(403).json({ error: 'No tenes acceso a este evento privado.' });
      }

      const existe = await pool.query(
        'SELECT 1 FROM event_saves WHERE user_id = $1 AND event_id = $2',
        [req.user.id, id]
      );

      if (existe.rowCount > 0) {
        await pool.query('DELETE FROM event_saves WHERE user_id = $1 AND event_id = $2', [req.user.id, id]);
        return res.json({ guardado: false });
      }

      await pool.query('INSERT INTO event_saves (user_id, event_id) VALUES ($1, $2)', [req.user.id, id]);
      res.json({ guardado: true });
    } catch (error) {
      console.error('Error al alternar guardado de evento:', error);
      res.status(500).json({ error: 'No se pudo actualizar el guardado del evento.' });
    }
  }
};

module.exports = eventoController;
