const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const supabaseAuth = supabase.authClient || supabase;
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

const COLOR_PRINCIPAL_REEL_FALLBACK = '#ffae00';
const PATRON_COLOR_HEX_COMPLETO = /^#[0-9a-fA-F]{6}$/;
const VIGENCIA_COLUMNAS_REELS_MS = 60 * 1000;

let esquemaComentariosListo = null;
let esquemaCompartidosListo = null;
let esquemaVisitasListo = null;
let columnasReelsPromesa = null;
let columnasReelsExpiranEn = 0;

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

function normalizarColorPrincipal(valor) {
  if (typeof valor !== 'string') return null;
  const color = valor.trim();
  return PATRON_COLOR_HEX_COMPLETO.test(color) ? color.toLowerCase() : null;
}

function primerValorDisponible(...valores) {
  return valores.find((valor) => valor !== undefined
    && valor !== null
    && (typeof valor !== 'string' || valor.trim() !== ''));
}

function obtenerArchivoReel(req, campo) {
  const archivosPorCampo = req.files?.[campo];
  if (Array.isArray(archivosPorCampo) && archivosPorCampo[0]) return archivosPorCampo[0];

  if (Array.isArray(req.files)) {
    const archivo = req.files.find((item) => item?.fieldname === campo);
    if (archivo) return archivo;
  }

  return req.file?.fieldname === campo ? req.file : null;
}

function normalizarDatosCreacionReel(req) {
  const body = req.body || {};

  return {
    titulo: String(primerValorDisponible(body.titulo, body.tema) || '').trim(),
    genero: String(primerValorDisponible(body.genero, body.genre) || '').trim().toLowerCase(),
    duracion: body.duracion,
    colorPrincipalRecibido: body.color_principal,
    portadaFile: obtenerArchivoReel(req, 'portada'),
    audioFile: obtenerArchivoReel(req, 'audio'),
  };
}

function oscurecerColorHex(color, factor = 0.35) {
  const colorSeguro = normalizarColorPrincipal(color) || COLOR_PRINCIPAL_REEL_FALLBACK;
  const componentes = colorSeguro.slice(1).match(/.{2}/g) || [];
  const hexOscuro = componentes
    .map((componente) => Math.round(Number.parseInt(componente, 16) * factor)
      .toString(16)
      .padStart(2, '0'))
    .join('');

  return hexOscuro.length === 6 ? `#${hexOscuro}` : '#593d00';
}

async function obtenerColumnasCompatibilidadReels() {
  const ahora = Date.now();

  if (!columnasReelsPromesa || ahora >= columnasReelsExpiranEn) {
    columnasReelsExpiranEn = ahora + VIGENCIA_COLUMNAS_REELS_MS;
    columnasReelsPromesa = pool.query(
      `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'reels'
         AND column_name IN ('album', 'descripcion', 'color_principal')`
    ).then((result) => new Map(result.rows.map((columna) => [columna.column_name, columna])))
      .catch((error) => {
        columnasReelsPromesa = null;
        columnasReelsExpiranEn = 0;
        throw error;
      });
  }

  return columnasReelsPromesa;
}

function requiereValorDeCompatibilidad(columna) {
  return columna?.is_nullable === 'NO' && columna.column_default === null;
}

async function insertarReelCompatible({
  titulo,
  genero,
  duracion,
  portada,
  audio,
  creadorId,
  colorPrincipal,
}) {
  const columnasDisponibles = await obtenerColumnasCompatibilidadReels();
  const columnas = [
    'titulo', 'genero', 'duracion', 'portada_url', 'portada_path',
    'audio_url', 'audio_path', 'creador_id',
  ];
  const valores = [
    titulo,
    genero,
    duracion || '0:30',
    portada?.publicUrl || null,
    portada?.path || null,
    audio.publicUrl,
    audio.path,
    creadorId,
  ];

  const agregarColumna = (nombre, valor) => {
    columnas.push(nombre);
    valores.push(valor);
  };

  // Compatibilidad temporal: instalaciones antiguas pueden exigir estos
  // campos aunque ya no formen parte del formulario ni del modelo visible.
  const columnaAlbum = columnasDisponibles.get('album');
  if (requiereValorDeCompatibilidad(columnaAlbum)) agregarColumna('album', titulo);

  const columnaDescripcion = columnasDisponibles.get('descripcion');
  if (requiereValorDeCompatibilidad(columnaDescripcion)) agregarColumna('descripcion', '');

  // La ausencia de esta columna no debe impedir publicar. La migracion SQL la
  // agrega de forma permanente y esta cache se renueva sin ejecutar DDL.
  if (columnasDisponibles.has('color_principal') && portada) {
    agregarColumna('color_principal', colorPrincipal);
  }

  const parametros = valores.map((_, indice) => `$${indice + 1}`).join(', ');
  return pool.query(
    `INSERT INTO reels (${columnas.join(', ')})
     VALUES (${parametros})
     RETURNING *`,
    valores
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
  const colorPrincipal = normalizarColorPrincipal(reel.color_principal);
  const colorVisual = colorPrincipal || COLOR_PRINCIPAL_REEL_FALLBACK;

  return {
    id: reel.id,
    artista: reel.creador_nombre || reel.creador_email?.split('@')[0] || 'Artista SONDAR',
    usuario: reel.creador_nombre ? `@${String(reel.creador_nombre).replace(/^@/, '')}` : '@artista',
    oyentes: '0',
    tema: reel.titulo,
    genero: reel.genero,
    duracion: reel.duracion || '0:30',
    progreso: 0,
    likes: Number(reel.likes_calculados ?? reel.likes ?? 0),
    comentarios: '0',
    compartidos: Number(reel.compartidos_calculados ?? reel.compartidos ?? 0),
    visitas: Number(reel.visitas_calculadas ?? reel.visitas ?? 0),
    colorPrincipal,
    colorA: colorVisual,
    colorB: oscurecerColorHex(colorVisual),
    colorC: '#111111',
    portada: reel.portada_url,
    audio: reel.audio_url,
    avatar: reel.creador_avatar || reel.profile_img_url || '',
    liked: false,
    siguiendo: false,
    recomendado: Boolean(
      reel.afinidad_score > 0
      || reel.sigue_creador
      || reel.afinidad_edad > 0
      || reel.es_exploracion
      || (reel.distancia_evento_km !== null && reel.distancia_evento_km !== undefined)
    ),
    recomendacion: reel.motivo_recomendacion || '',
    afinidadEdad: Number(reel.afinidad_edad || 0),
    afinidadAprendida: Number(reel.afinidad_aprendida || 0),
    exploracion: Boolean(reel.es_exploracion),
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
  let ultimoCreador = null;
  let creadorRepetido = 0;

  while (pendientes.length > 0) {
    let indice = 0;
    if (repetidos >= 2 || creadorRepetido >= 2) {
      const alternativo = pendientes.findIndex((reel) => {
        const generoCandidato = String(reel.genero || '').toLowerCase();
        const creadorCandidato = String(reel.creador_id || '');
        return (repetidos < 2 || generoCandidato !== ultimoGenero)
          && (creadorRepetido < 2 || creadorCandidato !== ultimoCreador);
      });
      if (alternativo >= 0) indice = alternativo;
    }

    const [siguiente] = pendientes.splice(indice, 1);
    const genero = String(siguiente.genero || '').toLowerCase();
    repetidos = genero && genero === ultimoGenero ? repetidos + 1 : 1;
    const creador = String(siguiente.creador_id || '');
    creadorRepetido = creador && creador === ultimoCreador ? creadorRepetido + 1 : 1;
    ultimoGenero = genero;
    ultimoCreador = creador;
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
      const creadorFiltro = String(req.query?.creador || '').trim() || null;
      if (creadorFiltro && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creadorFiltro)) {
        return res.status(400).json({ error: 'El creador solicitado no es valido.' });
      }
      const ordenReels = creadorFiltro
        ? 'r.created_at DESC, r.id DESC'
        : 'recomendacion_score DESC, r.created_at DESC, r.id DESC';
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
          FROM reel_shares rs
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

          UNION ALL
          SELECT uga.genre,
                 GREATEST(-20::numeric, LEAST(55::numeric,
                   uga.behavioral_score
                   * EXP(-EXTRACT(EPOCH FROM (NOW() - uga.last_interaction_at)) / 10368000)
                 )) AS peso
          FROM user_genre_affinity uga
          WHERE uga.user_id = $1
        ), afinidad_generos AS (
          SELECT genre, GREATEST(-20::numeric, LEAST(70::numeric, SUM(peso))) AS puntaje
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
          (SELECT COUNT(*)::int FROM reel_views rv WHERE rv.reel_id = r.id) AS visitas_calculadas,
          COALESCE(ag.puntaje, 0)::float AS afinidad_score,
          COALESCE(afinidad_aprendida.puntaje, 0)::float AS afinidad_aprendida,
          COALESCE(exploracion.activa, false) AS es_exploracion,
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
                + LN(1 + (SELECT COUNT(*) FROM reel_shares rs WHERE rs.reel_id = r.id)) * 4
                + LN(1 + (SELECT COUNT(*) FROM reel_views rv WHERE rv.reel_id = r.id)) * 2
              )
            + GREATEST(0, 18 - EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400)
            + CASE WHEN COALESCE(exploracion.activa, false) THEN 12 ELSE 0 END
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
            WHEN COALESCE(afinidad_aprendida.puntaje, 0) > 0 THEN 'Basado en las previews que escuchaste'
            WHEN COALESCE(ag.puntaje, 0) > 0 THEN 'Basado en tu actividad'
            WHEN COALESCE(exploracion.activa, false) THEN 'Para ampliar tus descubrimientos'
            WHEN r.created_at >= NOW() - INTERVAL '7 days' THEN 'Nuevo en SONDAR'
            ELSE 'Popular en SONDAR'
          END AS motivo_recomendacion,
          COALESCE(u.username, u.email) AS creador_nombre,
          u.email AS creador_email,
          u.profile_img_url AS creador_avatar
        FROM reels r
        LEFT JOIN users u ON u.id = r.creador_id
        LEFT JOIN afinidad_generos ag ON ag.genre = lower(r.genero)
        LEFT JOIN LATERAL (
          SELECT GREATEST(-20::numeric, LEAST(55::numeric,
            uga.behavioral_score
            * EXP(-EXTRACT(EPOCH FROM (NOW() - uga.last_interaction_at)) / 10368000)
          )) AS puntaje
          FROM user_genre_affinity uga
          WHERE uga.user_id = $1 AND uga.genre = lower(r.genero)
        ) afinidad_aprendida ON true
        LEFT JOIN LATERAL (
          SELECT (
            $1::uuid IS NOT NULL
            AND mod(abs(hashtext(
              r.id::text || ':' || $1::text || ':' || CURRENT_DATE::text
            )::bigint), 100) < 15
          ) AS activa
        ) exploracion ON true
        LEFT JOIN follows f ON f.follower_id = $1 AND f.following_id = r.creador_id
        LEFT JOIN reel_views visto ON visto.user_id = $1 AND visto.reel_id = r.id
        LEFT JOIN LATERAL (
          SELECT COUNT(DISTINCT senal.user_id)::int AS personas
          FROM (
            SELECT rl.user_id FROM reel_likes rl WHERE rl.reel_id = r.id
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
            gis.ST_Distance(
              ev.ubicacion_geog,
              gis.ST_SetSRID(gis.ST_MakePoint($3::double precision, $2::double precision), 4326)::gis.geography
            ) / 1000.0
          ) AS distancia_km
          FROM eventos ev
          WHERE ev.creador_id = r.creador_id
            AND ev.fecha >= NOW()
            AND ev.ubicacion_geog IS NOT NULL
        ) cercania ON $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL
        WHERE ($4::uuid IS NULL OR r.creador_id = $4::uuid)
          AND ($1::uuid IS NULL OR NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = $1 AND ub.blocked_id = r.creador_id)
               OR (ub.blocker_id = r.creador_id AND ub.blocked_id = $1)
          ))
        ORDER BY ${ordenReels}
      `, [viewerId, viewerLat, viewerLng, creadorFiltro]);

      const reelsOrdenados = diversificarReels(result.rows);

      if (!viewerId || reelsOrdenados.length === 0) {
        return res.json(reelsOrdenados.map(mapearReel));
      }

      const reelIds = reelsOrdenados.map((reel) => reel.id);
      const creadorIds = [...new Set(reelsOrdenados.map((reel) => reel.creador_id).filter(Boolean))];
      const [likedSet, siguiendoSet] = await Promise.all([
        consultarSetInteraccion(
          'SELECT reel_id FROM reel_likes WHERE user_id = $1 AND reel_id = ANY($2::bigint[])',
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
           (SELECT COUNT(*)::int FROM reel_views rv_count WHERE rv_count.reel_id = r.id) AS visitas_calculadas,
           EXISTS (
             SELECT 1 FROM reel_likes rl
             WHERE rl.reel_id = r.id AND rl.user_id = $2::uuid
           ) AS liked,
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

  registrarInteraccionEscucha: async (req, res) => {
    const reelId = String(req.params.id || '').replace(/^db-/, '');
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!/^\d+$/.test(reelId)) {
      return res.status(400).json({ error: 'El reel no es valido.' });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
      return res.status(400).json({ error: 'La sesion de escucha no es valida.' });
    }

    const listenedMs = Math.max(0, Math.min(3600000, Math.round(Number(req.body?.listenedMs) || 0)));
    const durationValue = Math.round(Number(req.body?.durationMs));
    const durationMs = Number.isFinite(durationValue)
      ? Math.max(1, Math.min(3600000, durationValue))
      : null;
    const completionRatio = Math.max(0, Math.min(
      1,
      Number.isFinite(Number(req.body?.completionRatio))
        ? Number(req.body.completionRatio)
        : durationMs ? listenedMs / durationMs : 0
    ));
    const replayCount = Math.max(0, Math.min(100, Math.round(Number(req.body?.replayCount) || 0)));

    try {
      await asegurarUsuarioPublico(req.user);
      const result = await pool.query(
        `INSERT INTO public.reel_playback_sessions (
           id, user_id, reel_id, listened_ms, duration_ms,
           completion_ratio, completed, skipped, replay_count
         )
         SELECT $1, $2, r.id, $4, $5, $6, $7, $8, $9
         FROM public.reels r
         WHERE r.id = $3
         ON CONFLICT (id) DO UPDATE
         SET listened_ms = GREATEST(public.reel_playback_sessions.listened_ms, EXCLUDED.listened_ms),
             duration_ms = COALESCE(EXCLUDED.duration_ms, public.reel_playback_sessions.duration_ms),
             completion_ratio = GREATEST(public.reel_playback_sessions.completion_ratio, EXCLUDED.completion_ratio),
             completed = public.reel_playback_sessions.completed OR EXCLUDED.completed,
             skipped = public.reel_playback_sessions.skipped OR EXCLUDED.skipped,
             replay_count = GREATEST(public.reel_playback_sessions.replay_count, EXCLUDED.replay_count),
             updated_at = timezone('utc'::text, now())
         WHERE public.reel_playback_sessions.user_id = EXCLUDED.user_id
         RETURNING id, listened_ms, completion_ratio, completed, skipped, replay_count`,
        [
          sessionId,
          req.user.id,
          reelId,
          listenedMs,
          durationMs,
          completionRatio,
          Boolean(req.body?.completed) || completionRatio >= 0.95,
          Boolean(req.body?.skipped),
          replayCount,
        ]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }
      return res.status(202).json({ ok: true, session: result.rows[0] });
    } catch (error) {
      if (error.code === '42P01') {
        return res.status(503).json({
          error: 'Falta aplicar la migracion del algoritmo de recomendaciones.',
          code: 'RECOMMENDATION_SCHEMA_MISSING',
        });
      }
      console.error('Error al registrar escucha:', error);
      return res.status(500).json({ error: 'No se pudo registrar la escucha.' });
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
    const {
      titulo,
      genero,
      duracion,
      colorPrincipalRecibido,
      portadaFile,
      audioFile,
    } = normalizarDatosCreacionReel(req);
    const colorPrincipal = normalizarColorPrincipal(colorPrincipalRecibido);
    const colorPrincipalInformado = colorPrincipalRecibido !== undefined
      && colorPrincipalRecibido !== null
      && String(colorPrincipalRecibido).trim() !== '';
    let portadaSubida = null;
    let audioSubido = null;

    const camposFaltantes = [
      !titulo && 'titulo',
      !genero && 'genero',
      !audioFile && 'audio',
    ].filter(Boolean);

    if (camposFaltantes.length > 0) {
      return res.status(400).json({
        error: `Faltan datos obligatorios del reel: ${camposFaltantes.join(', ')}.`,
        camposFaltantes,
      });
    }

    if (colorPrincipalInformado && !colorPrincipal) {
      return res.status(400).json({ error: 'El color principal debe tener el formato hexadecimal #RRGGBB.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      portadaSubida = await subirPortadaReel(portadaFile, req.user.id, req.accessToken);
      audioSubido = await subirAudioReel(audioFile, req.user.id, req.accessToken);

      const result = await insertarReelCompatible({
        titulo,
        genero,
        duracion,
        portada: portadaSubida,
        audio: audioSubido,
        creadorId: req.user.id,
        colorPrincipal,
      });

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
  }
};

module.exports = reelController;
