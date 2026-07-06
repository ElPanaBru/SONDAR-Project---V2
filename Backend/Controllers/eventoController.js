const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const { subirImagenEvento, eliminarImagenEvento } = require('../services/storageService');
const {
  crearNotificacion,
  nombreActor,
  notificarSeguidores,
} = require('../services/notificationService');
const { asegurarEsquemaModeracion, registrarDenuncia } = require('../services/moderationService');

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

async function buscarAccesoEvento(eventoId) {
  const result = await pool.query(
    'SELECT id FROM eventos WHERE id = $1',
    [eventoId]
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
  const username = `${baseUsername}`.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9._-]/g, '').slice(0, 21) || 'usuario';
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
      await asegurarEsquemaModeracion();
      const viewerId = await obtenerViewerId(req);
      const latitudRecibida = Number(req.query?.lat);
      const longitudRecibida = Number(req.query?.lng);
      const viewerLat = Number.isFinite(latitudRecibida) && Math.abs(latitudRecibida) <= 90
        ? latitudRecibida
        : null;
      const viewerLng = Number.isFinite(longitudRecibida) && Math.abs(longitudRecibida) <= 180
        ? longitudRecibida
        : null;
      const result = await pool.query(`
        WITH contexto AS (
          SELECT CASE
            WHEN u.birth_date IS NOT NULL
              THEN EXTRACT(YEAR FROM age(CURRENT_DATE, u.birth_date))::int
            ELSE NULL
          END AS edad
          FROM (SELECT 1) semilla
          LEFT JOIN users u ON u.id = $1
        ), eventos_personalizados AS (
          SELECT
            e.*,
            EXISTS (
              SELECT 1
              FROM user_interests ui
              WHERE ui.user_id = $1 AND ui.genre = lower(e.genero)
            ) AS coincide_interes,
            CASE
              WHEN $2::double precision IS NULL OR $3::double precision IS NULL THEN NULL
              ELSE 6371 * acos(LEAST(1, GREATEST(-1,
                cos(radians($2::double precision)) * cos(radians(e.latitud))
                * cos(radians(e.longitud) - radians($3::double precision))
                + sin(radians($2::double precision)) * sin(radians(e.latitud))
              )))
            END AS distancia_km,
            CASE WHEN contexto.edad IS NULL THEN 0 ELSE (
              SELECT COUNT(*)::int
              FROM event_saves es
              JOIN users usuario_similar ON usuario_similar.id = es.user_id
              WHERE es.event_id = e.id
                AND usuario_similar.birth_date IS NOT NULL
                AND abs(
                  EXTRACT(YEAR FROM age(CURRENT_DATE, usuario_similar.birth_date))::int
                  - contexto.edad
                ) <= 5
            ) END AS guardados_misma_edad
          FROM eventos e
          CROSS JOIN contexto
        )
        SELECT
          e.*,
          e.img_url AS img,
          COALESCE(u.display_name, u.username, 'Anonimo') AS creador,
          u.profile_img_url AS avatar,
          COALESCE(org.organizadores, '[]'::jsonb) AS organizadores,
          ROUND((
            CASE WHEN e.coincide_interes THEN 45 ELSE 0 END
            + CASE
                WHEN e.distancia_km IS NULL THEN 0
                WHEN e.distancia_km <= 5 THEN 35
                WHEN e.distancia_km <= 20 THEN 28
                WHEN e.distancia_km <= 50 THEN 20
                WHEN e.distancia_km <= 100 THEN 10
                ELSE 0
              END
            + LEAST(20, LN(1 + e.guardados_misma_edad) * 8)
            + CASE WHEN e.fecha >= NOW() THEN 5 ELSE -20 END
          )::numeric, 2)::float AS recomendacion_score,
          CASE
            WHEN e.coincide_interes THEN 'Coincide con tus gustos'
            WHEN e.distancia_km <= 20 THEN 'Cerca de vos'
            WHEN e.guardados_misma_edad > 0 THEN 'Popular entre personas de tu edad'
            ELSE 'Evento en SONDAR'
          END AS motivo_recomendacion
        FROM eventos_personalizados e
        LEFT JOIN users u ON u.id = e.creador_id
        LEFT JOIN LATERAL (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', co.id,
              'username', co.username,
              'nombre', COALESCE(co.display_name, co.username),
              'avatar', COALESCE(co.profile_img_url, '')
            )
            ORDER BY eo.created_at
          ) AS organizadores
          FROM event_organizers eo
          JOIN users co ON co.id = eo.user_id
          WHERE eo.event_id = e.id
        ) org ON true
        WHERE $1::uuid IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id = $1 AND ub.blocked_id = e.creador_id)
             OR (ub.blocker_id = e.creador_id AND ub.blocked_id = $1)
        )
        ORDER BY recomendacion_score DESC, e.fecha ASC, e.id DESC
      `, [viewerId, viewerLat, viewerLng]);

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

  denunciarEvento: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('SELECT id, creador_id FROM eventos WHERE id = $1', [id]);
      const evento = result.rows[0];
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado.' });
      const resultado = await registrarDenuncia({
        reporterId: req.user.id,
        reportedUserId: evento.creador_id,
        contentType: 'evento',
        contentId: id,
        reason: req.body?.reason,
        details: req.body?.detail,
      });
      res.json(resultado);
    } catch (error) {
      console.error('Error al denunciar evento:', error);
      res.status(error.status || 500).json({ error: error.message || 'No se pudo denunciar el evento.' });
    }
  },

  crearEvento: async (req, res) => {
    const { titulo, descripcion, genero, ubicacion, fecha, precio, link, latitud, longitud, organizadores } = req.body;
    const creadorId = req.user.id;
    let imagenSubida = null;
    let dbClient = null;
    let transaccionActiva = false;

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
      transaccionActiva = true;

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
             COALESCE(u.display_name, u.username) AS nombre,
             COALESCE(u.profile_img_url, '') AS avatar
           FROM event_organizers eo
           JOIN users u ON u.id = eo.user_id
           WHERE eo.event_id = $1
           ORDER BY eo.created_at`,
          [result.rows[0].id]
        )
        : { rows: [] };
      await dbClient.query('COMMIT');
      transaccionActiva = false;

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
      });

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
        });
      }

      res.status(201).json(mapearEvento({
        ...result.rows[0],
        creador: creadorNombre,
        organizadores: organizadoresResult.rows,
      }));
    } catch (error) {
      if (dbClient && transaccionActiva) await dbClient.query('ROLLBACK').catch(() => {});
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

      const evento = await buscarAccesoEvento(id);
      if (!evento) {
        return res.status(404).json({ error: 'Evento no encontrado.' });
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
