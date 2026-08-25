const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const supabaseAuth = supabase.authClient || supabase;
const { eliminarImagenEvento } = require('../services/storageService');
const {
  crearNotificacion,
  nombreActor,
  notificarSeguidores,
} = require('../services/notificationService');
const { asegurarEsquemaModeracion, registrarDenuncia } = require('../services/moderationService');

const MAX_GENEROS_EVENTO = 3;
const GENEROS_EVENTO_PERMITIDOS = new Set([
  'pop', 'rock', 'edm', 'jazz', 'blues', 'cumbia', 'trap', 'metal',
  'folklore', 'alternativo', 'punk', 'reggae', 'latina', 'otros',
]);

async function obtenerViewerId(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
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
  const generos = [...new Set(
    (Array.isArray(evento.generos) ? evento.generos : [evento.genero])
      .map((genero) => String(genero || '').trim().toLowerCase())
      .filter(Boolean)
  )].slice(0, MAX_GENEROS_EVENTO);
  const resultado = {
    ...evento,
    genero: generos[0] || evento.genero || 'otros',
    generos: generos.length > 0 ? generos : ['otros'],
    creador: evento.creador || null
  };
  delete resultado.titulo;
  delete resultado.descripcion;
  return resultado;
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

function primerValorDisponible(...valores) {
  return valores.find((valor) => valor !== undefined
    && valor !== null
    && (typeof valor !== 'string' || valor.trim() !== ''));
}

function normalizarCoordenada(valor) {
  if (typeof valor === 'string' && !valor.trim()) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarGenerosEvento(body = {}) {
  const valorMultiple = primerValorDisponible(body.generos, body.genres);
  let recibidos = valorMultiple;

  if (typeof recibidos === 'string') {
    try {
      recibidos = JSON.parse(recibidos);
    } catch {
      recibidos = [recibidos];
    }
  }

  if (!Array.isArray(recibidos) || recibidos.length === 0) {
    recibidos = [primerValorDisponible(body.genero, body.genre)].filter(Boolean);
  }

  const generos = [...new Set(
    recibidos
      .map((genero) => String(genero || '').trim().toLowerCase())
      .filter(Boolean)
  )];

  if (generos.length > MAX_GENEROS_EVENTO) {
    return { generos, error: `Podes elegir hasta ${MAX_GENEROS_EVENTO} generos por evento.` };
  }

  const noPermitidos = generos.filter((genero) => !GENEROS_EVENTO_PERMITIDOS.has(genero));
  if (noPermitidos.length > 0) {
    return { generos, error: `Generos no permitidos: ${noPermitidos.join(', ')}.` };
  }

  return { generos, error: null };
}

function normalizarDatosEvento(body = {}) {
  const generosNormalizados = normalizarGenerosEvento(body);
  const genero = generosNormalizados.generos[0] || '';
  const ubicacion = String(primerValorDisponible(body.ubicacion, body.lugar, body.location) || '').trim();
  const fecha = String(primerValorDisponible(body.fecha, body.date) || '').trim();
  const latitud = normalizarCoordenada(primerValorDisponible(body.latitud, body.lat));
  const longitud = normalizarCoordenada(primerValorDisponible(body.longitud, body.lng, body.lon));

  return {
    genero,
    generos: generosNormalizados.generos,
    errorGeneros: generosNormalizados.error,
    ubicacion,
    fecha,
    precio: body.precio,
    link: body.link,
    latitud,
    longitud,
    organizadores: body.organizadores,
  };
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
      const radioRecibido = Number(req.query?.radioKm);
      const radioKm = Number.isFinite(radioRecibido) && radioRecibido > 0
        ? Math.min(500, radioRecibido)
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
              WHERE ui.user_id = $1
                AND (
                  ui.genre = lower(e.genero)
                  OR EXISTS (
                    SELECT 1
                    FROM evento_generos eg_interes
                    WHERE eg_interes.event_id = e.id
                      AND eg_interes.genero = ui.genre
                  )
                )
            ) AS coincide_interes,
            CASE
              WHEN $2::double precision IS NULL
                OR $3::double precision IS NULL
                OR e.ubicacion_geog IS NULL THEN NULL
              ELSE gis.ST_Distance(
                e.ubicacion_geog,
                gis.ST_SetSRID(gis.ST_MakePoint($3::double precision, $2::double precision), 4326)::gis.geography
              ) / 1000.0
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
          COALESCE(gen.generos, ARRAY[e.genero]) AS generos,
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
          SELECT array_agg(eg.genero ORDER BY eg.posicion) AS generos
          FROM evento_generos eg
          WHERE eg.event_id = e.id
        ) gen ON true
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
        WHERE (
          $4::double precision IS NULL
          OR $2::double precision IS NULL
          OR $3::double precision IS NULL
          OR (
            e.ubicacion_geog IS NOT NULL
            AND gis.ST_DWithin(
              e.ubicacion_geog,
              gis.ST_SetSRID(gis.ST_MakePoint($3::double precision, $2::double precision), 4326)::gis.geography,
              $4::double precision * 1000.0
            )
          )
        )
        AND ($1::uuid IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $1 AND ub.blocked_id = e.creador_id)
               OR (ub.blocker_id = e.creador_id AND ub.blocked_id = $1)
        ))
        ORDER BY recomendacion_score DESC, e.fecha ASC, e.id DESC
      `, [viewerId, viewerLat, viewerLng, radioKm]);

      if (!viewerId || result.rows.length === 0) {
        return res.json(result.rows.map(mapearEvento));
      }

      try {
        const guardados = await pool.query(
          'SELECT event_id FROM event_saves WHERE user_id = $1 AND event_id = ANY($2::bigint[])',
          [viewerId, result.rows.map((evento) => evento.id)]
        );
        const guardadoSet = new Set(guardados.rows.map((row) => String(row.event_id)));

        return res.json(result.rows.map((evento) => mapearEvento({
          ...evento,
          guardado: guardadoSet.has(String(evento.id)),
        })));
      } catch (error) {
        if (error.code !== '42P01') throw error;
        return res.json(result.rows.map(mapearEvento));
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
    const {
      genero,
      generos,
      errorGeneros,
      ubicacion,
      fecha,
      precio,
      link,
      latitud,
      longitud,
      organizadores,
    } = normalizarDatosEvento(req.body);
    const creadorId = req.user.id;
    let dbClient = null;
    let transaccionActiva = false;

    const creadorNombre =
      req.user?.user_metadata?.name ||
      req.user?.user_metadata?.username ||
      req.user?.email?.split('@')[0] ||
      'Anonimo';

    if (errorGeneros) {
      return res.status(400).json({ error: errorGeneros });
    }


    const camposFaltantes = [
      !genero && 'genero',
      !ubicacion && 'ubicacion',
      !fecha && 'fecha',
      latitud === null && 'latitud',
      longitud === null && 'longitud',
    ].filter(Boolean);

    if (camposFaltantes.length > 0) {
      return res.status(400).json({
        error: `Faltan datos obligatorios del evento: ${camposFaltantes.join(', ')}.`,
        camposFaltantes,
      });
    }

    if (Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
      return res.status(400).json({ error: 'La ubicacion seleccionada no es valida.' });
    }

    if (Number.isNaN(Date.parse(fecha))) {
      return res.status(400).json({ error: 'La fecha del evento no es valida.' });
    }

    let organizadorIds = [];
    try {
      const recibidos = Array.isArray(organizadores)
        ? organizadores
        : organizadores
          ? JSON.parse(organizadores)
          : [];
      if (!Array.isArray(recibidos)) throw new Error('Formato invalido');
      organizadorIds = [...new Set(recibidos
        .map((id) => String(id || '').trim())
        .filter((id) => id && id !== creadorId))];
    } catch {
      return res.status(400).json({ error: 'La lista de invitados no es valida.' });
    }

    if (organizadorIds.length > 8) {
      return res.status(400).json({ error: 'Podes agregar hasta 8 invitados o bandas invitadas.' });
    }

    const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (organizadorIds.some((id) => !uuidValido.test(id))) {
      return res.status(400).json({ error: 'Hay un invitado invalido.' });
    }

    const precioNormalizado = precio === '' || precio === undefined || precio === null
      ? null
      : Number(precio);

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
          return res.status(400).json({ error: 'Uno de los invitados ya no esta disponible.' });
        }
      }

      dbClient = await pool.connect();
      await dbClient.query('BEGIN');
      transaccionActiva = true;

      const query = `
        INSERT INTO eventos (genero, lugar, fecha, precio, link, creador_id, latitud, longitud)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`;

      const values = [
        genero,
        ubicacion,
        fecha,
        precioNormalizado,
        link || null,
        creadorId,
        latitud,
        longitud
      ];

      const result = await dbClient.query(query, values);

      await dbClient.query(
        `INSERT INTO evento_generos (event_id, genero, posicion)
         SELECT $1, seleccion.genero, seleccion.posicion::smallint
         FROM unnest($2::text[]) WITH ORDINALITY AS seleccion(genero, posicion)`,
        [result.rows[0].id, generos]
      );

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
        body: `${generos.join(', ')} - ${ubicacion}`,
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
          title: `${actorName} te agrego como invitado a un evento`,
          body: `${generos.join(', ')} - ${ubicacion}`,
          targetUrl: `/?evento=${result.rows[0].id}`,
          entityType: 'event',
          entityId: result.rows[0].id,
          uniqueKey: `event-coorganizer:${result.rows[0].id}:${organizador.id}`,
        });
      }

      res.status(201).json(mapearEvento({
        ...result.rows[0],
        generos,
        creador: creadorNombre,
        organizadores: organizadoresResult.rows,
      }));
    } catch (error) {
      if (dbClient && transaccionActiva) await dbClient.query('ROLLBACK').catch(() => {});
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

      await eliminarImagenEvento(result.rows[0].img_path, req.accessToken).catch((error) => {
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
