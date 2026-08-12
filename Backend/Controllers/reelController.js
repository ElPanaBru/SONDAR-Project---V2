const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const {
  subirPortadaReel,
  subirAudioReel,
  eliminarArchivoReel
} = require('../services/storageService');
const {
  crearNotificacion,
  eliminarNotificacion,
  nombreActor,
  notificarMenciones,
  notificarSeguidores,
} = require('../services/notificationService');
const { asegurarEsquemaModeracion, registrarDenuncia } = require('../services/moderationService');

let esquemaComentariosListo = null;
let esquemaCompartidosListo = null;
let esquemaVisitasListo = null;

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

async function buscarAccesoReel(reelId, client = pool) {
  const result = await client.query(
    `SELECT
       r.id,
       r.creador_id,
       r.titulo
     FROM reels r
     WHERE r.id = $1`,
    [reelId]
  );
  return result.rows[0] || null;
}

async function buscarAccesoComentario(comentarioId, client = pool) {
  const result = await client.query(
    `SELECT
       rc.id,
       rc.user_id,
       rc.reel_id,
       rc.texto
     FROM reel_comments rc
     WHERE rc.id = $1`,
    [comentarioId]
  );
  return result.rows[0] || null;
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

async function asegurarEsquemaComentarios() {
  if (!esquemaComentariosListo) {
    esquemaComentariosListo = (async () => {
      await pool.query('ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS responde_a text');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reel_comment_likes (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          comment_id bigint NOT NULL REFERENCES reel_comments(id) ON DELETE CASCADE,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          CONSTRAINT reel_comment_likes_pkey PRIMARY KEY (user_id, comment_id)
        )
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_reel_comment_likes_comment_id ON reel_comment_likes(comment_id)'
      );
    })().catch((error) => {
      esquemaComentariosListo = null;
      throw error;
    });
  }

  return esquemaComentariosListo;
}

async function asegurarEsquemaCompartidos() {
  if (!esquemaCompartidosListo) {
    esquemaCompartidosListo = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reel_shares (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reel_id bigint NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          CONSTRAINT reel_shares_pkey PRIMARY KEY (user_id, reel_id)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reel_shares_reel_id ON reel_shares(reel_id)');
    })().catch((error) => {
      esquemaCompartidosListo = null;
      throw error;
    });
  }

  return esquemaCompartidosListo;
}

async function asegurarEsquemaVisitas() {
  if (!esquemaVisitasListo) {
    esquemaVisitasListo = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reel_views (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reel_id bigint NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
          CONSTRAINT reel_views_pkey PRIMARY KEY (user_id, reel_id)
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_reel_views_reel_id ON reel_views(reel_id)');
    })().catch((error) => {
        esquemaVisitasListo = null;
        throw error;
      });
  }

  return esquemaVisitasListo;
}

function mapearReel(reel) {
  return {
    id: reel.id,
    artista: reel.creador_nombre || reel.creador_email?.split('@')[0] || 'Artista SONDAR',
    usuario: reel.creador_nombre ? `@${String(reel.creador_nombre).replace(/^@/, '')}` : '@artista',
    oyentes: '0',
    tema: reel.titulo,
    album: reel.album,
    genero: reel.genero,
    descripcion: reel.descripcion,
    duracion: reel.duracion || '0:30',
    progreso: 0,
    likes: Number(reel.likes_calculados ?? reel.likes ?? 0),
    comentarios: '0',
    compartidos: Number(reel.compartidos_calculados ?? reel.compartidos ?? 0),
    guardados: Number(reel.guardados_calculados ?? reel.guardados ?? 0),
    visitas: Number(reel.visitas_calculadas ?? reel.visitas ?? 0),
    colorA: '#ffae00',
    colorB: '#ff5e00',
    colorC: '#111111',
    portada: reel.portada_url,
    audio: reel.audio_url,
    avatar: reel.creador_avatar || reel.profile_img_url || '',
    liked: false,
    guardado: false,
    siguiendo: false,
    recomendado: Boolean(
      reel.afinidad_score > 0
      || reel.sigue_creador
      || reel.afinidad_edad > 0
      || (reel.distancia_evento_km !== null && reel.distancia_evento_km !== undefined)
    ),
    recomendacion: reel.motivo_recomendacion || '',
    afinidadEdad: Number(reel.afinidad_edad || 0),
    distanciaEventoKm: reel.distancia_evento_km === null || reel.distancia_evento_km === undefined
      ? null
      : Number(reel.distancia_evento_km),
    creadorId: reel.creador_id,
    backendId: reel.id,
  };
}

function diversificarReels(rows) {
  const pendientes = [...rows];
  const resultado = [];
  let ultimoGenero = null;
  let repetidos = 0;

  while (pendientes.length > 0) {
    let indice = 0;
    if (repetidos >= 2) {
      const alternativo = pendientes.findIndex((reel) => String(reel.genero || '').toLowerCase() !== ultimoGenero);
      if (alternativo >= 0) indice = alternativo;
    }

    const [siguiente] = pendientes.splice(indice, 1);
    const genero = String(siguiente.genero || '').toLowerCase();
    repetidos = genero && genero === ultimoGenero ? repetidos + 1 : 1;
    ultimoGenero = genero;
    resultado.push(siguiente);
  }

  return resultado;
}

function tiempoRelativo(fecha) {
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return '';

  const segundos = Math.max(0, Math.floor((Date.now() - valor.getTime()) / 1000));
  if (segundos < 60) return 'ahora';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

function mapearComentario(row) {
  const username = row.username || row.email?.split('@')[0] || 'usuario';

  return {
    id: row.id,
    reelId: row.reel_id,
    userId: row.user_id,
    usuario: `@${String(username).replace(/^@/, '')}`,
    avatar: row.profile_img_url || '',
    tiempo: tiempoRelativo(row.created_at),
    texto: row.texto,
    likes: Number(row.likes_calculados ?? row.likes ?? 0),
    liked: Boolean(row.liked),
    parentId: row.parent_id,
    respondeA: row.responde_a || '',
    respuestas: [],
  };
}

function anidarComentarios(rows) {
  const porId = new Map();
  const principales = [];

  rows.forEach((row) => {
    const comentario = mapearComentario(row);
    porId.set(String(comentario.id), comentario);
  });

  porId.forEach((comentario) => {
    if (comentario.parentId) {
      const padre = porId.get(String(comentario.parentId));
      if (padre) {
        padre.respuestas.push(comentario);
        return;
      }
    }

    principales.push(comentario);
  });

  return principales;
}

async function consultarSetInteraccion(query, params, campo) {
  try {
    const result = await pool.query(query, params);
    return new Set(result.rows.map((row) => String(row[campo])));
  } catch (error) {
    if (error.code === '42P01') {
      return new Set();
    }

    throw error;
  }
}

const reelController = {
  listarReels: async (req, res) => {
    try {
      await asegurarEsquemaVisitas();
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
        WITH senales_afinidad AS (
          SELECT ui.genre, 30::numeric AS peso
          FROM user_interests ui
          WHERE ui.user_id = $1

          UNION ALL
          SELECT lower(r.genero), 6::numeric
          FROM reel_likes rl
          JOIN reels r ON r.id = rl.reel_id
          WHERE rl.user_id = $1

          UNION ALL
          SELECT lower(r.genero), 8::numeric
          FROM reel_saves rs
          JOIN reels r ON r.id = rs.reel_id
          WHERE rs.user_id = $1

          UNION ALL
          SELECT lower(r.genero), 4::numeric
          FROM reel_comments rc
          JOIN reels r ON r.id = rc.reel_id
          WHERE rc.user_id = $1

          UNION ALL
          SELECT lower(r.genero), 1::numeric
          FROM reel_views rv
          JOIN reels r ON r.id = rv.reel_id
          WHERE rv.user_id = $1
        ), afinidad_generos AS (
          SELECT genre, LEAST(45::numeric, SUM(peso)) AS puntaje
          FROM senales_afinidad
          WHERE genre IS NOT NULL AND genre <> ''
          GROUP BY genre
        ), contexto_viewer AS (
          SELECT CASE
            WHEN u.birth_date IS NOT NULL
              THEN EXTRACT(YEAR FROM age(CURRENT_DATE, u.birth_date))::int
            ELSE NULL
          END AS edad
          FROM (SELECT 1) semilla
          LEFT JOIN users u ON u.id = $1
        )
        SELECT
          r.*,
          (SELECT COUNT(*)::int FROM reel_likes rl WHERE rl.reel_id = r.id) AS likes_calculados,
          (SELECT COUNT(*)::int FROM reel_shares rs WHERE rs.reel_id = r.id) AS compartidos_calculados,
          (SELECT COUNT(*)::int FROM reel_saves rg WHERE rg.reel_id = r.id) AS guardados_calculados,
          (SELECT COUNT(*)::int FROM reel_views rv WHERE rv.reel_id = r.id) AS visitas_calculadas,
          COALESCE(ag.puntaje, 0)::float AS afinidad_score,
          (f.follower_id IS NOT NULL) AS sigue_creador,
          (visto.user_id IS NOT NULL) AS ya_visto,
          COALESCE(edad.personas, 0)::int AS afinidad_edad,
          cercania.distancia_km::float AS distancia_evento_km,
          ROUND((
            COALESCE(ag.puntaje, 0)
            + CASE WHEN f.follower_id IS NOT NULL THEN 22 ELSE 0 END
            + LEAST(15, LN(1 + COALESCE(edad.personas, 0)) * 7)
            + CASE
                WHEN cercania.distancia_km IS NULL THEN 0
                WHEN cercania.distancia_km <= 5 THEN 20
                WHEN cercania.distancia_km <= 25 THEN 15
                WHEN cercania.distancia_km <= 75 THEN 8
                ELSE 0
              END
            + LEAST(
                18,
                LN(1 + (SELECT COUNT(*) FROM reel_likes rl WHERE rl.reel_id = r.id)) * 5
                + LN(1 + (SELECT COUNT(*) FROM reel_saves rs WHERE rs.reel_id = r.id)) * 6
                + LN(1 + (SELECT COUNT(*) FROM reel_views rv WHERE rv.reel_id = r.id)) * 2
              )
            + GREATEST(0, 18 - EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400)
            - CASE WHEN visto.user_id IS NOT NULL THEN 10 ELSE 0 END
            - CASE WHEN r.creador_id = $1 THEN 12 ELSE 0 END
          )::numeric, 2)::float AS recomendacion_score,
          CASE
            WHEN f.follower_id IS NOT NULL THEN 'De un artista que seguis'
            WHEN EXISTS (
              SELECT 1 FROM user_interests ui
              WHERE ui.user_id = $1 AND ui.genre = lower(r.genero)
            ) THEN 'Porque elegiste ' || r.genero
            WHEN cercania.distancia_km <= 25 THEN 'Este artista toca cerca de vos'
            WHEN COALESCE(edad.personas, 0) > 0 THEN 'Popular entre personas de tu edad'
            WHEN COALESCE(ag.puntaje, 0) > 0 THEN 'Basado en tu actividad'
            WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN 'Nuevo en SONDAR'
            ELSE 'Popular en SONDAR'
          END AS motivo_recomendacion,
          COALESCE(u.username, u.email) AS creador_nombre,
          u.email AS creador_email,
          u.profile_img_url AS creador_avatar
        FROM reels r
        LEFT JOIN users u ON u.id = r.creador_id
        LEFT JOIN afinidad_generos ag ON ag.genre = lower(r.genero)
        LEFT JOIN follows f ON f.follower_id = $1 AND f.following_id = r.creador_id
        LEFT JOIN reel_views visto ON visto.user_id = $1 AND visto.reel_id = r.id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT senal.user_id)::int AS personas
          FROM (
            SELECT rl.user_id FROM reel_likes rl WHERE rl.reel_id = r.id
            UNION ALL
            SELECT rs.user_id FROM reel_saves rs WHERE rs.reel_id = r.id
            UNION ALL
            SELECT rv.user_id FROM reel_views rv WHERE rv.reel_id = r.id
          ) senal
          JOIN users usuario_similar ON usuario_similar.id = senal.user_id
          CROSS JOIN contexto_viewer cv
          WHERE cv.edad IS NOT NULL
            AND usuario_similar.birth_date IS NOT NULL
            AND abs(
              EXTRACT(YEAR FROM age(CURRENT_DATE, usuario_similar.birth_date))::int
              - cv.edad
            ) <= 5
        ) edad ON true
        LEFT JOIN LATERAL (
          SELECT MIN(
            6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians($2::double precision)) * cos(radians(ev.latitud))
              * cos(radians(ev.longitud) - radians($3::double precision))
              + sin(radians($2::double precision)) * sin(radians(ev.latitud))
            )))
          ) AS distancia_km
          FROM eventos ev
          WHERE ev.creador_id = r.creador_id
            AND ev.fecha >= NOW()
        ) cercania ON $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL
        WHERE $1::uuid IS NULL OR NOT EXISTS (
          SELECT 1 FROM user_blocks ub
          WHERE (ub.blocker_id = $1 AND ub.blocked_id = r.creador_id)
             OR (ub.blocker_id = r.creador_id AND ub.blocked_id = $1)
        )
        ORDER BY recomendacion_score DESC, r.created_at DESC, r.id DESC
      `, [viewerId, viewerLat, viewerLng]);

      const reelsOrdenados = diversificarReels(result.rows);

      if (!viewerId || reelsOrdenados.length === 0) {
        return res.json(reelsOrdenados.map(mapearReel));
      }

      const reelIds = reelsOrdenados.map((reel) => reel.id);
      const creadorIds = [...new Set(reelsOrdenados.map((reel) => reel.creador_id).filter(Boolean))];
      const [likedSet, guardadoSet, siguiendoSet] = await Promise.all([
        consultarSetInteraccion(
          'SELECT reel_id FROM reel_likes WHERE user_id = $1 AND reel_id = ANY($2::bigint[])',
          [viewerId, reelIds],
          'reel_id'
        ),
        consultarSetInteraccion(
          'SELECT reel_id FROM reel_saves WHERE user_id = $1 AND reel_id = ANY($2::bigint[])',
          [viewerId, reelIds],
          'reel_id'
        ),
        creadorIds.length > 0
          ? consultarSetInteraccion(
              'SELECT following_id FROM follows WHERE follower_id = $1 AND following_id = ANY($2::uuid[])',
              [viewerId, creadorIds],
              'following_id'
            )
          : Promise.resolve(new Set()),
      ]);

      res.json(reelsOrdenados.map((reel) => ({
        ...mapearReel(reel),
        liked: likedSet.has(String(reel.id)),
        guardado: guardadoSet.has(String(reel.id)),
        siguiendo: siguiendoSet.has(String(reel.creador_id)),
      })));
    } catch (error) {
      console.error('Error al listar reels:', error);
      res.status(500).json({ error: 'Error al obtener los reels.' });
    }
  },

  obtenerReel: async (req, res) => {
    const reelId = String(req.params.id || '').replace(/^db-/, '');
    if (!/^\d+$/.test(reelId)) {
      return res.status(400).json({ error: 'El identificador del reel no es valido.' });
    }

    try {
      await asegurarEsquemaModeracion();
      const viewerId = await obtenerViewerId(req);
      const result = await pool.query(
        `SELECT
           r.*,
           (SELECT COUNT(*)::int FROM reel_likes rl_count WHERE rl_count.reel_id = r.id) AS likes_calculados,
           (SELECT COUNT(*)::int FROM reel_shares rs_count WHERE rs_count.reel_id = r.id) AS compartidos_calculados,
           (SELECT COUNT(*)::int FROM reel_saves rg_count WHERE rg_count.reel_id = r.id) AS guardados_calculados,
           (SELECT COUNT(*)::int FROM reel_views rv_count WHERE rv_count.reel_id = r.id) AS visitas_calculadas,
           EXISTS (
             SELECT 1 FROM reel_likes rl
             WHERE rl.reel_id = r.id AND rl.user_id = $2::uuid
           ) AS liked,
           EXISTS (
             SELECT 1 FROM reel_saves rs
             WHERE rs.reel_id = r.id AND rs.user_id = $2::uuid
           ) AS guardado,
           EXISTS (
             SELECT 1 FROM follows f
             WHERE f.following_id = r.creador_id AND f.follower_id = $2::uuid
           ) AS siguiendo,
           COALESCE(u.username, u.email) AS creador_nombre,
           u.email AS creador_email,
           u.profile_img_url AS creador_avatar
         FROM reels r
         LEFT JOIN users u ON u.id = r.creador_id
         WHERE r.id = $1`,
        [reelId, viewerId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }

      const reel = result.rows[0];
      return res.json({
        ...mapearReel(reel),
        liked: Boolean(reel.liked),
        guardado: Boolean(reel.guardado),
        siguiendo: Boolean(reel.siguiendo),
      });
    } catch (error) {
      console.error('Error al obtener el reel:', error);
      return res.status(500).json({ error: 'No se pudo cargar el reel.' });
    }
  },

  registrarVisita: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaVisitas();
      await client.query('BEGIN');
      const reel = await buscarAccesoReel(id, client);
      if (!reel) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }
      const visita = await client.query(
        `INSERT INTO reel_views (user_id, reel_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, reel_id) DO NOTHING
         RETURNING reel_id`,
        [req.user.id, id]
      );
      const result = await client.query(
        'SELECT COUNT(*)::int AS visitas FROM reel_views WHERE reel_id = $1',
        [id]
      );
      await client.query('COMMIT');
      res.json({
        visitas: Number(result.rows[0]?.visitas || 0),
        nuevaVisita: visita.rowCount > 0,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al registrar visita de reel:', error);
      res.status(500).json({ error: 'No se pudo registrar la visita.' });
    } finally {
      client.release();
    }
  },

  denunciarReel: async (req, res) => {
    const { id } = req.params;
    try {
      const reel = await buscarAccesoReel(id);
      if (!reel) return res.status(404).json({ error: 'Reel no encontrado.' });
      const resultado = await registrarDenuncia({
        reporterId: req.user.id,
        reportedUserId: reel.creador_id,
        contentType: 'reel',
        contentId: id,
        reason: req.body?.reason,
        details: req.body?.detail,
      });
      res.json(resultado);
    } catch (error) {
      console.error('Error al denunciar reel:', error);
      res.status(error.status || 500).json({ error: error.message || 'No se pudo denunciar el reel.' });
    }
  },

  listarComentarios: async (req, res) => {
    const { id } = req.params;

    try {
      await asegurarEsquemaComentarios();
      const viewerId = await obtenerViewerId(req);
      const acceso = await buscarAccesoReel(id);
      if (!acceso) return res.status(404).json({ error: 'Reel no encontrado.' });
      const result = await pool.query(
        `SELECT
          rc.*,
          (SELECT COUNT(*)::int FROM reel_comment_likes rcl_count WHERE rcl_count.comment_id = rc.id) AS likes_calculados,
          u.username,
          u.email,
          u.profile_img_url,
          EXISTS (
            SELECT 1
            FROM reel_comment_likes rcl
            WHERE rcl.comment_id = rc.id
              AND rcl.user_id = $2
          ) AS liked
        FROM reel_comments rc
        LEFT JOIN users u ON u.id = rc.user_id
        WHERE rc.reel_id = $1
        ORDER BY rc.created_at ASC, rc.id ASC`,
        [id, viewerId]
      );

      res.json(anidarComentarios(result.rows));
    } catch (error) {
      if (error.code === '42P01') {
        return res.json([]);
      }

      console.error('Error al listar comentarios:', error);
      res.status(500).json({ error: 'No se pudieron cargar los comentarios.' });
    }
  },

  crearComentario: async (req, res) => {
    const { id } = req.params;
    const { texto, parentId, respondeA } = req.body;
    const textoLimpio = texto?.trim();
    const respondeALimpio = respondeA?.trim() || null;

    if (!textoLimpio) {
      return res.status(400).json({ error: 'El comentario no puede estar vacio.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComentarios();
      const acceso = await buscarAccesoReel(id);
      if (!acceso) return res.status(404).json({ error: 'Reel no encontrado.' });

      const result = await pool.query(
        `INSERT INTO reel_comments (reel_id, user_id, parent_id, texto, responde_a)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, req.user.id, parentId || null, textoLimpio, parentId ? respondeALimpio : null]
      );

      const usuarioResult = await pool.query(
        `SELECT u.username, u.email, u.profile_img_url
         FROM users u
         WHERE u.id = $1`,
        [req.user.id]
      );

      const destinoResult = await pool.query(
        `SELECT
           r.creador_id,
           r.titulo,
           padre.user_id AS parent_user_id
         FROM reels r
         LEFT JOIN reel_comments padre ON padre.id = $2
         WHERE r.id = $1`,
        [id, parentId || null]
      );
      const destino = destinoResult.rows[0];
      const usuarioRespondidoResult = parentId && respondeALimpio
        ? await pool.query(
          `SELECT id
           FROM users
           WHERE lower(username) = lower(regexp_replace($1, '^@', ''))
           LIMIT 1`,
          [respondeALimpio]
        )
        : { rows: [] };
      const usuarioRespondidoId = usuarioRespondidoResult.rows[0]?.id;
      const receptorId = parentId
        ? (usuarioRespondidoId || destino?.parent_user_id)
        : destino?.creador_id;
      const esRespuestaARespuesta = Boolean(
        parentId && usuarioRespondidoId && usuarioRespondidoId !== destino?.parent_user_id
      );
      const actorName = nombreActor(req.user);
      await crearNotificacion({
        userId: receptorId,
        actorId: req.user.id,
        type: parentId ? 'reel_reply' : 'reel_comment',
        title: parentId
          ? `${actorName} respondio tu ${esRespuestaARespuesta ? 'respuesta' : 'comentario'}`
          : `${actorName} comento tu reel`,
        body: textoLimpio,
        targetUrl: `/descubrir?lanzamiento=db-${id}&comentario=${result.rows[0].id}`,
        entityType: 'reel_comment',
        entityId: result.rows[0].id,
        uniqueKey: `reel-comment:${result.rows[0].id}:${receptorId}`,
      });
      await notificarMenciones({
        texto: textoLimpio,
        actorId: req.user.id,
        actorName,
        targetUrl: `/descubrir?lanzamiento=db-${id}&comentario=${result.rows[0].id}`,
        entityType: 'reel_comment',
        entityId: result.rows[0].id,
      });

      res.status(201).json(mapearComentario({
        ...result.rows[0],
        username: usuarioResult.rows[0]?.username,
        email: usuarioResult.rows[0]?.email || req.user.email,
        profile_img_url: usuarioResult.rows[0]?.profile_img_url,
      }));
    } catch (error) {
      console.error('Error al crear comentario:', error);
      res.status(500).json({ error: 'No se pudo guardar el comentario.' });
    }
  },

  crearReel: async (req, res) => {
    const { tema, album, genero, descripcion, duracion } = req.body;
    const portadaFile = req.files?.portada?.[0];
    const audioFile = req.files?.audio?.[0];
    let portadaSubida = null;
    let audioSubido = null;

    if (!tema || !album || !genero || !audioFile) {
      return res.status(400).json({ error: 'Faltan datos obligatorios del reel.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      portadaSubida = await subirPortadaReel(portadaFile, req.user.id, req.accessToken);
      audioSubido = await subirAudioReel(audioFile, req.user.id, req.accessToken);

      const result = await pool.query(
        `INSERT INTO reels (
          titulo, album, genero, descripcion, duracion,
          portada_url, portada_path, audio_url, audio_path, creador_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          tema,
          album,
          genero,
          descripcion || 'Nuevo reel publicado en SONDAR.',
          duracion || '0:30',
          portadaSubida?.publicUrl || null,
          portadaSubida?.path || null,
          audioSubido.publicUrl,
          audioSubido.path,
          req.user.id
        ]
      );

      const usuarioResult = await pool.query(
        `SELECT u.profile_img_url
         FROM users u
         WHERE u.id = $1`,
        [req.user.id]
      );

      const actorName = nombreActor(req.user);
      await notificarSeguidores({
        actorId: req.user.id,
        type: 'new_reel',
        title: `${actorName} publico un nuevo reel`,
        body: result.rows[0].titulo,
        targetUrl: `/descubrir?lanzamiento=db-${result.rows[0].id}`,
        entityType: 'reel',
        entityId: result.rows[0].id,
        uniquePrefix: `new-reel:${result.rows[0].id}`,
      });
      await notificarMenciones({
        texto: descripcion,
        actorId: req.user.id,
        actorName,
        targetUrl: `/descubrir?lanzamiento=db-${result.rows[0].id}`,
        entityType: 'reel',
        entityId: result.rows[0].id,
      });

      res.status(201).json(mapearReel({
        ...result.rows[0],
        creador_nombre: req.user.user_metadata?.username || req.user.email?.split('@')[0],
        creador_email: req.user.email,
        creador_avatar: usuarioResult.rows[0]?.profile_img_url || '',
      }));
    } catch (error) {
      await eliminarArchivoReel(portadaSubida?.path, req.accessToken).catch(() => null);
      await eliminarArchivoReel(audioSubido?.path, req.accessToken).catch(() => null);
      console.error('Error al crear reel:', error);
      res.status(error.status || 500).json({ error: error.message || 'No se pudo guardar el reel.' });
    }
  },

  eliminarReel: async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(
        'DELETE FROM reels WHERE id = $1 AND creador_id = $2 RETURNING id, portada_path, audio_path',
        [id, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Reel no encontrado o sin permiso para eliminarlo.' });
      }

      await eliminarArchivoReel(result.rows[0].portada_path, req.accessToken).catch(() => null);
      await eliminarArchivoReel(result.rows[0].audio_path, req.accessToken).catch(() => null);
      res.json({ ok: true, id: result.rows[0].id });
    } catch (error) {
      console.error('Error al eliminar reel:', error);
      res.status(500).json({ error: 'No se pudo eliminar el reel.' });
    }
  },

  eliminarComentario: async (req, res) => {
    const { comentarioId } = req.params;

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComentarios();

      const result = await pool.query(
        `DELETE FROM reel_comments
         WHERE id = $1 AND user_id = $2
         RETURNING id, reel_id, parent_id`,
        [comentarioId, req.user.id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Comentario no encontrado o sin permiso para eliminarlo.' });
      }

      res.json({
        ok: true,
        id: Number(result.rows[0].id),
        reelId: Number(result.rows[0].reel_id),
        parentId: result.rows[0].parent_id ? Number(result.rows[0].parent_id) : null,
      });
    } catch (error) {
      console.error('Error al eliminar comentario:', error);
      res.status(500).json({ error: 'No se pudo eliminar el comentario.' });
    }
  },

  alternarLike: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await client.query('BEGIN');

      const reel = await buscarAccesoReel(id, client);
      if (!reel) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM reel_likes WHERE user_id = $1 AND reel_id = $2',
        [req.user.id, id]
      );

      let liked = false;
      if (existe.rowCount > 0) {
        await client.query('DELETE FROM reel_likes WHERE user_id = $1 AND reel_id = $2', [req.user.id, id]);
      } else {
        await client.query('INSERT INTO reel_likes (user_id, reel_id) VALUES ($1, $2)', [req.user.id, id]);
        liked = true;
        await crearNotificacion({
          userId: reel.creador_id,
          actorId: req.user.id,
          type: 'reel_like',
          title: `${nombreActor(req.user)} indico que le gusta tu reel`,
          body: reel.titulo || '',
          targetUrl: `/descubrir?lanzamiento=db-${id}`,
          entityType: 'reel',
          entityId: id,
          uniqueKey: `reel-like:${req.user.id}:${id}`,
        }, client);
      }

      if (!liked) {
        await eliminarNotificacion(`reel-like:${req.user.id}:${id}`, client);
      }

      const counts = await client.query('SELECT COUNT(*)::int AS likes FROM reel_likes WHERE reel_id = $1', [id]);
      await client.query('COMMIT');

      res.json({
        liked,
        likes: Number(counts.rows[0]?.likes || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar like de reel:', error);
      res.status(500).json({ error: 'No se pudo actualizar el favorito.' });
    } finally {
      client.release();
    }
  },

  alternarLikeComentario: async (req, res) => {
    const { comentarioId } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComentarios();
      await client.query('BEGIN');

      const comentario = await buscarAccesoComentario(comentarioId, client);
      if (!comentario) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Comentario no encontrado.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM reel_comment_likes WHERE user_id = $1 AND comment_id = $2',
        [req.user.id, comentarioId]
      );

      let liked = false;
      if (existe.rowCount > 0) {
        await client.query(
          'DELETE FROM reel_comment_likes WHERE user_id = $1 AND comment_id = $2',
          [req.user.id, comentarioId]
        );
      } else {
        await client.query(
          'INSERT INTO reel_comment_likes (user_id, comment_id) VALUES ($1, $2)',
          [req.user.id, comentarioId]
        );
        liked = true;
        await crearNotificacion({
          userId: comentario.user_id,
          actorId: req.user.id,
          type: 'reel_comment_like',
          title: `${nombreActor(req.user)} indico que le gusta tu comentario`,
          body: comentario.texto || '',
          targetUrl: `/descubrir?lanzamiento=db-${comentario.reel_id}&comentario=${comentarioId}`,
          entityType: 'reel_comment',
          entityId: comentarioId,
          uniqueKey: `reel-comment-like:${req.user.id}:${comentarioId}`,
        }, client);
      }

      if (!liked) {
        await eliminarNotificacion(`reel-comment-like:${req.user.id}:${comentarioId}`, client);
      }

      const counts = await client.query(
        'SELECT COUNT(*)::int AS likes FROM reel_comment_likes WHERE comment_id = $1',
        [comentarioId]
      );
      await client.query('COMMIT');

      res.json({
        id: Number(comentarioId),
        liked,
        likes: Number(counts.rows[0]?.likes || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar like de comentario:', error);
      res.status(500).json({ error: 'No se pudo actualizar el me gusta.' });
    } finally {
      client.release();
    }
  },

  registrarCompartido: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaCompartidos();
      await client.query('BEGIN');

      const reel = await buscarAccesoReel(id, client);
      if (!reel) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }

      const compartido = await client.query(
        `INSERT INTO reel_shares (user_id, reel_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, reel_id) DO NOTHING`,
        [req.user.id, id]
      );

      const counts = await client.query(
        'SELECT COUNT(*)::int AS compartidos FROM reel_shares WHERE reel_id = $1',
        [id]
      );
      await client.query('COMMIT');

      res.json({
        compartido: true,
        nuevoCompartido: compartido.rowCount > 0,
        compartidos: Number(counts.rows[0]?.compartidos || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al registrar compartido:', error);
      res.status(500).json({ error: 'No se pudo registrar el compartido.' });
    } finally {
      client.release();
    }
  },

  alternarGuardado: async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await client.query('BEGIN');

      const reel = await buscarAccesoReel(id, client);
      if (!reel) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM reel_saves WHERE user_id = $1 AND reel_id = $2',
        [req.user.id, id]
      );

      let guardado = false;
      if (existe.rowCount > 0) {
        await client.query('DELETE FROM reel_saves WHERE user_id = $1 AND reel_id = $2', [req.user.id, id]);
      } else {
        await client.query('INSERT INTO reel_saves (user_id, reel_id) VALUES ($1, $2)', [req.user.id, id]);
        guardado = true;
      }

      const counts = await client.query('SELECT COUNT(*)::int AS guardados FROM reel_saves WHERE reel_id = $1', [id]);
      await client.query('COMMIT');

      res.json({
        guardado,
        guardados: Number(counts.rows[0]?.guardados || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar guardado de reel:', error);
      res.status(500).json({ error: 'No se pudo actualizar el guardado.' });
    } finally {
      client.release();
    }
  }
};

module.exports = reelController;
