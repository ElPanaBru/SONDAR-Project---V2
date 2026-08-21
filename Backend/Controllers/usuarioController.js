const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const {
  crearNotificacion,
  eliminarNotificacion,
  nombreActor,
} = require('../services/notificationService');
const {
  subirAvatarUsuario,
  eliminarAvatarUsuario,
  eliminarImagenEvento,
  eliminarArchivoReel,
  extraerRutaPublica,
  EVENTOS_BUCKET,
  REELS_BUCKET,
  PERFILES_BUCKET,
} = require('../services/storageService');
const { asegurarEsquemaModeracion, registrarDenuncia } = require('../services/moderationService');
const supabaseAuth = supabase.authClient || supabase;

const CONFIGURACION_INICIAL = Object.freeze({
  telefono: '',
  codigoPais: '+54',
  idioma: 'es',
  actividadCuenta: true,
  notificarInteracciones: true,
  notificarComentarios: true,
  notificarSeguidores: true,
  notificarPublicaciones: true,
  notificarMenciones: true,
  reducirMovimiento: false,
  mostrarEmail: false,
});

const IDIOMAS_VALIDOS = new Set(['es', 'en', 'pt']);
const CODIGOS_PAIS_VALIDOS = new Set(['+54', '+55', '+56', '+598']);
const PATRON_USERNAME = /^[a-z0-9._-]{3,30}$/;
const GENEROS_ONBOARDING = new Set(['pop', 'rock', 'trap', 'cumbia', 'edm', 'jazz', 'blues', 'metal', 'folklore']);
const CREAR_AUTH_POR_SQL = String(process.env.AUTH_CREATE_VIA_SQL || 'true').toLowerCase() !== 'false';

function normalizarUsername(valor = '') {
  return String(valor).trim().replace(/^@+/, '').toLowerCase();
}

function validarUsername(valor) {
  const username = normalizarUsername(valor);
  if (!PATRON_USERNAME.test(username)) {
    return { error: 'El @ debe tener entre 3 y 30 caracteres y usar solo letras, numeros, punto, guion o guion bajo.' };
  }
  return { username };
}

function mapearConfiguracion(row = {}) {
  return {
    telefono: row.telefono || '',
    codigoPais: row.codigo_pais || CONFIGURACION_INICIAL.codigoPais,
    idioma: row.idioma || CONFIGURACION_INICIAL.idioma,
    actividadCuenta: row.actividad_cuenta ?? CONFIGURACION_INICIAL.actividadCuenta,
    notificarInteracciones: row.notificar_interacciones ?? CONFIGURACION_INICIAL.notificarInteracciones,
    notificarComentarios: row.notificar_comentarios ?? CONFIGURACION_INICIAL.notificarComentarios,
    notificarSeguidores: row.notificar_seguidores ?? CONFIGURACION_INICIAL.notificarSeguidores,
    notificarPublicaciones: row.notificar_publicaciones ?? CONFIGURACION_INICIAL.notificarPublicaciones,
    notificarMenciones: row.notificar_menciones ?? CONFIGURACION_INICIAL.notificarMenciones,
    reducirMovimiento: row.reducir_movimiento ?? CONFIGURACION_INICIAL.reducirMovimiento,
    mostrarEmail: row.mostrar_email ?? CONFIGURACION_INICIAL.mostrarEmail,
  };
}

function validarConfiguracion(body = {}) {
  const configuracion = {
    telefono: String(body.telefono || '').trim().slice(0, 30),
    codigoPais: String(body.codigoPais || ''),
    idioma: String(body.idioma || ''),
    actividadCuenta: body.actividadCuenta,
    notificarInteracciones: body.notificarInteracciones,
    notificarComentarios: body.notificarComentarios,
    notificarSeguidores: body.notificarSeguidores,
    notificarPublicaciones: body.notificarPublicaciones,
    notificarMenciones: body.notificarMenciones,
    reducirMovimiento: body.reducirMovimiento,
    mostrarEmail: body.mostrarEmail,
  };

  if (!IDIOMAS_VALIDOS.has(configuracion.idioma)) {
    return { error: 'El idioma seleccionado no es valido.' };
  }
  if (!CODIGOS_PAIS_VALIDOS.has(configuracion.codigoPais)) {
    return { error: 'El codigo de pais seleccionado no es valido.' };
  }
  const booleanos = [
    'actividadCuenta', 'notificarInteracciones', 'notificarComentarios',
    'notificarSeguidores', 'notificarPublicaciones', 'notificarMenciones',
    'reducirMovimiento', 'mostrarEmail',
  ];
  if (booleanos.some((campo) => typeof configuracion[campo] !== 'boolean')) {
    return { error: 'La configuracion contiene valores invalidos.' };
  }

  return { configuracion };
}

function validarFechaNacimiento(valor) {
  const texto = String(valor || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return { error: 'La fecha de nacimiento no es valida.' };
  }

  const fecha = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    return { error: 'La fecha de nacimiento no es valida.' };
  }

  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - fecha.getUTCFullYear();
  const todaviaNoCumplio = hoy.getUTCMonth() < fecha.getUTCMonth()
    || (hoy.getUTCMonth() === fecha.getUTCMonth() && hoy.getUTCDate() < fecha.getUTCDate());
  if (todaviaNoCumplio) edad -= 1;

  if (edad < 13) return { error: 'Debes tener al menos 13 años para crear una cuenta.' };
  if (edad > 120) return { error: 'La fecha de nacimiento no es valida.' };
  return { birthDate: texto };
}

function validarGenerosOnboarding(valor) {
  let recibidos;
  try {
    recibidos = typeof valor === 'string' ? JSON.parse(valor) : valor;
  } catch {
    return { error: 'La selección de géneros no es válida.' };
  }
  if (!Array.isArray(recibidos)) return { error: 'La selección de géneros no es válida.' };
  const generos = [...new Set(recibidos.map((item) => String(item || '').toLowerCase().trim()))];
  if (generos.length < 3) return { error: 'Elegí al menos 3 géneros para continuar.' };
  if (generos.length > 9 || generos.some((genre) => !GENEROS_ONBOARDING.has(genre))) {
    return { error: 'La selección de géneros no es válida.' };
  }
  return { generos };
}

function esTimeoutSupabase(error) {
  const mensaje = String(error?.message || error?.error_description || '').toLowerCase();
  return error?.code === 'SUPABASE_TIMEOUT'
    || error?.name === 'AbortError'
    || mensaje.includes('upstream request timeout')
    || mensaje.includes('tardo demasiado')
    || mensaje.includes('timeout');
}

function esUsuarioAuthExistente(error) {
  const mensaje = String(error?.message || error?.error_description || '').toLowerCase();
  return error?.code === 'USER_ALREADY_REGISTERED'
    || mensaje.includes('already been registered')
    || mensaje.includes('user already registered')
    || mensaje.includes('already registered')
    || mensaje.includes('correo ya esta registrado');
}

function esKeySupabaseInvalida(error) {
  const mensaje = String(error?.message || error?.error_description || error?.msg || '').toLowerCase();
  return error?.status === 401
    || error?.code === 401
    || mensaje.includes('unregistered api key')
    || mensaje.includes('invalid api key')
    || mensaje.includes('api key');
}

function esErrorValidacionArchivo(error) {
  const mensaje = String(error?.message || '').toLowerCase();
  return mensaje.includes('formato de imagen')
    || mensaje.includes('imagen no puede superar')
    || mensaje.includes('file too large');
}

function esErrorStorageNoBloqueante(error) {
  const mensaje = String(error?.message || error?.error_description || error?.msg || '').toLowerCase();
  return esTimeoutSupabase(error)
    || esKeySupabaseInvalida(error)
    || mensaje.includes('invalid compact jws')
    || mensaje.includes('jwt')
    || mensaje.includes('storage')
    || mensaje.includes('no se pudo subir');
}

async function subirAvatarOpcional(file, userId, contexto, accessToken) {
  if (!file) return { avatar: null, advertencia: null };

  try {
    return {
      avatar: await subirAvatarUsuario(file, userId, accessToken),
      advertencia: null,
    };
  } catch (error) {
    if (esErrorValidacionArchivo(error) || !esErrorStorageNoBloqueante(error)) {
      throw error;
    }

    console.warn(`No se pudo subir avatar en ${contexto}; se continua sin foto:`, error.message);
    return {
      avatar: null,
      advertencia: 'No se pudo guardar la foto ahora, pero el perfil se completo.',
    };
  }
}

async function recuperarUsuarioAuthConPassword(email, password) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error || !data?.user?.id) return null;
  return data.user;
}

async function crearUsuarioAuthPorSql({ email, password, username, userType }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change_token_new, email_change,
         email_change_token_current, reauthentication_token, phone_change, phone_change_token,
         created_at, updated_at
       )
       VALUES (
         '00000000-0000-0000-0000-000000000000',
         gen_random_uuid(),
         'authenticated',
         'authenticated',
         $1,
         crypt($2, gen_salt('bf')),
         timezone('utc'::text, now()),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('username', $3::text, 'user_type', $4::text),
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         '',
         timezone('utc'::text, now()),
         timezone('utc'::text, now())
       )
       RETURNING id, email, raw_user_meta_data`,
      [email, password, username, userType]
    );

    const user = userResult.rows[0];
    await client.query(
      `INSERT INTO auth.identities (
         provider_id, user_id, identity_data, provider,
         last_sign_in_at, created_at, updated_at
       )
       VALUES (
         $1::text,
         $1::uuid,
         jsonb_build_object(
           'sub', $1::text,
           'email', $2::text,
           'email_verified', false,
           'phone_verified', false
         ),
         'email',
         timezone('utc'::text, now()),
         timezone('utc'::text, now()),
         timezone('utc'::text, now())
       )`,
      [user.id, email]
    );

    await client.query('COMMIT');
    return {
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.raw_user_meta_data || { username, user_type: userType },
      },
      creadoEnEsteRequest: true,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function crearUsuarioAuthConSignup({ email, password, username, userType }) {
  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        user_type: userType,
      },
    },
  });

  if (error) throw error;
  if (!data?.user?.id) throw new Error('Supabase no devolvio el usuario registrado.');
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    const errorExistente = new Error('El correo ya esta registrado.');
    errorExistente.code = 'USER_ALREADY_REGISTERED';
    throw errorExistente;
  }

  return { user: data.user, creadoEnEsteRequest: true };
}

async function eliminarUsuarioAuthCreado(userId) {
  if (!userId) return;
  await supabase.auth.admin.deleteUser(userId).catch(() => null);
  await pool.query('DELETE FROM auth.users WHERE id = $1', [userId]).catch(() => null);
}

async function crearUsuarioAuth({ email, password, username, userType }) {
  if (CREAR_AUTH_POR_SQL) {
    return crearUsuarioAuthPorSql({ email, password, username, userType });
  }

  let crear;
  try {
    crear = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        user_type: userType,
      },
    });
  } catch (error) {
    if (esKeySupabaseInvalida(error)) {
      return crearUsuarioAuthPorSql({ email, password, username, userType });
    }

    if (esTimeoutSupabase(error)) {
      const usuarioRecuperado = await recuperarUsuarioAuthConPassword(email, password).catch(() => null);
      if (usuarioRecuperado) {
        return { user: usuarioRecuperado, creadoEnEsteRequest: false };
      }
      return crearUsuarioAuthPorSql({ email, password, username, userType });
    }

    if (esUsuarioAuthExistente(error)) {
      const usuarioRecuperado = await recuperarUsuarioAuthConPassword(email, password).catch(() => null);
      if (usuarioRecuperado) {
        return { user: usuarioRecuperado, creadoEnEsteRequest: false };
      }
    }
    throw error;
  }

  if (crear.error && esKeySupabaseInvalida(crear.error)) {
    return crearUsuarioAuthPorSql({ email, password, username, userType });
  }

  if (!crear.error && crear.data?.user?.id) {
    return { user: crear.data.user, creadoEnEsteRequest: true };
  }

  if (crear.error && esTimeoutSupabase(crear.error)) {
    const usuarioRecuperado = await recuperarUsuarioAuthConPassword(email, password).catch(() => null);
    if (usuarioRecuperado) {
      return { user: usuarioRecuperado, creadoEnEsteRequest: false };
    }
    return crearUsuarioAuthPorSql({ email, password, username, userType });
  }

  if (crear.error && esUsuarioAuthExistente(crear.error)) {
    const usuarioRecuperado = await recuperarUsuarioAuthConPassword(email, password).catch(() => null);
    if (usuarioRecuperado) {
      return { user: usuarioRecuperado, creadoEnEsteRequest: false };
    }
  }

  if (crear.error) throw crear.error;
  throw new Error('Supabase no devolvio el usuario creado.');
}

async function buscarCuentaLocalExistente(email, username) {
  const result = await pool.query(
    `SELECT id, email, username
     FROM users
     WHERE lower(email) = lower($1) OR lower(username) = lower($2)
     LIMIT 1`,
    [email, username]
  );
  return result.rows[0] || null;
}

function programarNotificacionBienvenida(userId) {
  setImmediate(() => {
    crearNotificacion({
      userId,
      actorId: null,
      type: 'welcome',
      title: 'Bienvenido a SONDAR',
      body: 'Aca vas a ver seguidores, respuestas, menciones y actividad de tus publicaciones.',
      targetUrl: '/descubrir',
      uniqueKey: `welcome:${userId}`,
    }).catch((error) => {
      console.error('No se pudo programar la notificacion de bienvenida:', error);
    });
  });
}

async function obtenerConfiguracion(userId, client = pool) {
  const result = await client.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  return mapearConfiguracion(result.rows[0]);
}

function nombreVisible(usuario) {
  return (
    usuario?.display_name ||
    usuario?.username ||
    usuario?.email?.split('@')[0] ||
    'Usuario SONDAR'
  );
}

function usuarioVisible(usuario) {
  if (usuario?.username) return `@${usuario.username.replace(/^@/, '')}`;
  if (usuario?.email) return `@${usuario.email.split('@')[0]}`;
  return '@usuario';
}

function mapearUsuarioPerfil(usuario, configuracion = CONFIGURACION_INICIAL, esPropio = false) {
  return {
    id: usuario.id,
    email: esPropio || configuracion.mostrarEmail ? usuario.email : null,
    username: usuario.username,
    user_type: usuario.user_type,
    nombre: nombreVisible(usuario),
    usuario: usuarioVisible(usuario),
    bio: usuario.bio || 'Artista en SONDAR.',
    avatar: usuario.profile_img_url || '',
  };
}

function mapearUsuarioBusqueda(usuario, stats = {}) {
  return {
    id: usuario.id,
    username: usuario.username,
    user_type: usuario.user_type,
    nombre: nombreVisible(usuario),
    usuario: usuarioVisible(usuario),
    bio: usuario.bio || 'Artista en SONDAR.',
    avatar: usuario.profile_img_url || '',
    seguidores: Number(stats.seguidores || 0),
    publicaciones: Number(stats.publicaciones || 0),
  };
}

function mapearReelPerfil(reel) {
  return {
    id: reel.id,
    tipo: 'reel',
    nombre: reel.titulo,
    detalle: `${reel.genero || 'Reel'}${reel.duracion ? ` - ${reel.duracion}` : ''}`,
    imagen: reel.portada_url || '',
    audio: reel.audio_url || '',
    genero: reel.genero || '',
    creadorId: reel.creador_id,
    visitas: Number(reel.visitas_calculadas ?? reel.visitas ?? 0),
  };
}

function mapearEventoPerfil(evento) {
  return {
    id: evento.id,
    tipo: 'evento',
    nombre: evento.creador_nombre || evento.creador || 'Artista SONDAR',
    detalle: `${evento.genero || 'Evento'}${evento.lugar ? ` - ${evento.lugar}` : ''}`,
    imagen: '/sondar-icon.png',
    fecha: evento.fecha,
    genero: evento.genero || '',
    creadorId: evento.creador_id,
  };
}

async function asegurarUsuarioPublico(user) {
  const email = user.email || `${user.id}@sin-email.local`;
  const baseUsername =
    user.user_metadata?.username ||
    user.user_metadata?.name ||
    email.split('@')[0] ||
    'usuario';
  const username = normalizarUsername(baseUsername).replace(/[^a-z0-9._-]/g, '').slice(0, 21) || 'usuario';
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

async function buscarUsuarioPerfil(identificador) {
  const result = await pool.query(
    `SELECT *
     FROM users
     WHERE id::text = $1 OR lower(username) = lower($1)
     LIMIT 1`,
    [identificador]
  );

  return result.rows[0] || null;
}

async function consultarOpcional(query, params = [], fallbackRows = []) {
  try {
    return await pool.query(query, params);
  } catch (error) {
    if (error.code === '42P01') {
      return { rows: fallbackRows, rowCount: fallbackRows.length };
    }

    throw error;
  }
}

async function obtenerDatosPerfil(targetUserId, viewerUserId) {
  await asegurarEsquemaModeracion();
  const bloqueoResult = viewerUserId && targetUserId !== viewerUserId
    ? await pool.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [viewerUserId, targetUserId]
      )
    : { rowCount: 0 };
  const contenidoBloqueado = bloqueoResult.rowCount > 0;
  const [usuarioResult, reelsResult, eventosResult, publicacionesStatsResult] = await Promise.all([
    pool.query('SELECT * FROM users WHERE id = $1', [targetUserId]),
    pool.query(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM reel_views rv WHERE rv.reel_id = r.id) AS visitas_calculadas
       FROM reels r
       WHERE creador_id = $1
       ORDER BY created_at DESC, id DESC`,
      [targetUserId]
    ),
    pool.query(
      `SELECT e.*, COALESCE(u.display_name, u.username, 'Artista SONDAR') AS creador_nombre
       FROM eventos e
       LEFT JOIN users u ON u.id = e.creador_id
       WHERE e.creador_id = $1
       ORDER BY e.fecha DESC, e.id DESC`,
      [targetUserId]
    ),
    pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM reels WHERE creador_id = $1) AS reels,
        (SELECT COUNT(*)::int FROM eventos WHERE creador_id = $1) AS eventos`,
      [targetUserId]
    ),
  ]);

  const [
    favoritosResult,
    eventosGuardadosResult,
    seguidoresStatsResult,
    seguidosStatsResult,
    siguiendoResult,
    seguidoresResult,
    silenciadoResult,
    seguidosResult,
  ] = await Promise.all([
    consultarOpcional(
      `SELECT r.*,
              (SELECT COUNT(*)::int FROM reel_views rv WHERE rv.reel_id = r.id) AS visitas_calculadas
       FROM reel_likes rl
       JOIN reels r ON r.id = rl.reel_id
       WHERE rl.user_id = $1
       ORDER BY rl.created_at DESC`,
      [targetUserId]
    ),
    consultarOpcional(
      `SELECT e.*, COALESCE(u.display_name, u.username, 'Artista SONDAR') AS creador_nombre
       FROM event_saves es
       JOIN eventos e ON e.id = es.event_id
       LEFT JOIN users u ON u.id = e.creador_id
       WHERE es.user_id = $1
       ORDER BY es.created_at DESC`,
      [targetUserId]
    ),
    consultarOpcional(
      'SELECT COUNT(*)::int AS seguidores FROM follows WHERE following_id = $1',
      [targetUserId]
    ),
    consultarOpcional(
      'SELECT COUNT(*)::int AS seguidos FROM follows WHERE follower_id = $1',
      [targetUserId]
    ),
    viewerUserId
      ? consultarOpcional(
          'SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2) AS siguiendo',
          [viewerUserId, targetUserId]
        )
      : Promise.resolve({ rows: [{ siguiendo: false }] }),
    consultarOpcional(
      `SELECT u.*
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC`,
      [targetUserId]
    ),
    viewerUserId
      ? consultarOpcional(
          `SELECT EXISTS(
             SELECT 1 FROM notification_mutes
             WHERE user_id = $1 AND muted_user_id = $2
           ) AS silenciado`,
          [viewerUserId, targetUserId]
        )
      : Promise.resolve({ rows: [{ silenciado: false }] }),
    consultarOpcional(
      `SELECT u.*
       FROM follows f
       JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      [targetUserId]
    ),
  ]);

  const usuario = usuarioResult.rows[0];
  const publicacionesStats = publicacionesStatsResult.rows[0] || {};
  const seguidoresStats = seguidoresStatsResult.rows[0] || {};
  const seguidosStats = seguidosStatsResult.rows[0] || {};
  const reels = contenidoBloqueado ? [] : reelsResult.rows.map(mapearReelPerfil);
  const eventos = contenidoBloqueado ? [] : eventosResult.rows.map(mapearEventoPerfil);
  const eventosGuardados = eventosGuardadosResult.rows.map((evento) => ({
    ...mapearEventoPerfil(evento),
    guardadoTipo: 'evento',
  }));

  const configuracion = await obtenerConfiguracion(targetUserId).catch((error) => {
    if (error.code === '42P01') return CONFIGURACION_INICIAL;
    throw error;
  });
  const esPropio = targetUserId === viewerUserId;

  return {
    perfil: mapearUsuarioPerfil(usuario, configuracion, esPropio),
    publicaciones: reels,
    eventos,
    favoritos: esPropio ? favoritosResult.rows.map(mapearReelPerfil) : [],
    guardados: esPropio ? eventosGuardados : [],
    seguidores: seguidoresResult.rows.map((item) => mapearUsuarioPerfil(item)),
    seguidos: seguidosResult.rows.map((item) => mapearUsuarioPerfil(item)),
    siguiendo: Boolean(siguiendoResult.rows[0]?.siguiendo),
    silenciado: Boolean(silenciadoResult.rows[0]?.silenciado),
    stats: {
      publicaciones: contenidoBloqueado ? 0 : Number(publicacionesStats.reels || 0) + Number(publicacionesStats.eventos || 0),
      reels: contenidoBloqueado ? 0 : Number(publicacionesStats.reels || 0),
      eventos: contenidoBloqueado ? 0 : Number(publicacionesStats.eventos || 0),
      seguidores: Number(seguidoresStats.seguidores || 0),
      seguidos: Number(seguidosStats.seguidos || 0),
    },
  };
}

const usuariosController = {
  buscarUsuarios: async (req, res) => {
    const termino = String(req.query.query || '').trim();

    if (!termino) {
      return res.json([]);
    }

    try {
      const patron = `%${termino}%`;
      const result = await pool.query(
        `SELECT *
         FROM users
         WHERE
          username ILIKE $1 OR
          email ILIKE $1 OR
          COALESCE(display_name, '') ILIKE $1 OR
          COALESCE(bio, '') ILIKE $1
         ORDER BY
          CASE
            WHEN lower(username) = lower($2) THEN 0
            WHEN lower(COALESCE(display_name, username)) = lower($2) THEN 1
            ELSE 2
          END,
          created_at DESC
         LIMIT 20`,
        [patron, termino]
      );

      if (result.rows.length === 0) {
        return res.json([]);
      }

      let statsPorUsuario = {};
      try {
        const statsResult = await pool.query(
          `SELECT
            u.id,
            (SELECT COUNT(*)::int FROM follows f WHERE f.following_id = u.id) AS seguidores,
            (
              (SELECT COUNT(*)::int FROM reels r WHERE r.creador_id = u.id) +
              (SELECT COUNT(*)::int FROM eventos e WHERE e.creador_id = u.id)
            ) AS publicaciones
           FROM users u
           WHERE u.id = ANY($1::uuid[])`,
          [result.rows.map((usuario) => usuario.id)]
        );

        statsPorUsuario = Object.fromEntries(
          statsResult.rows.map((row) => [row.id, row])
        );
      } catch (error) {
        if (error.code !== '42P01') throw error;
      }

      res.json(result.rows.map((usuario) =>
        mapearUsuarioBusqueda(usuario, statsPorUsuario[usuario.id])
      ));
    } catch (error) {
      console.error('Error al buscar usuarios:', error);
      res.status(500).json({ error: 'No se pudieron buscar usuarios.' });
    }
  },

  crearCuenta: async (req, res) => {
    const { email, password, username, user_type } = req.body;
    const cleanEmail = email?.trim().toLowerCase();
    const validacionUsername = validarUsername(username);
    const cleanUsername = validacionUsername.username;
    const cleanPassword = typeof password === 'string' ? password : '';
    const tipoUsuario = user_type || process.env.DEFAULT_USER_TYPE || 'musico';
    let authUserId = null;
    let authCreadoEnEsteRequest = false;

    if (!cleanEmail || !cleanPassword || !username) {
      return res.status(400).json({ error: 'Email, contrasena y nombre de usuario son obligatorios.' });
    }
    if (validacionUsername.error) return res.status(400).json({ error: validacionUsername.error });

    if (cleanPassword.length < 8) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres.' });
    }

    if (!/[a-z]/.test(cleanPassword) || !/[A-Z]/.test(cleanPassword) || !/\d/.test(cleanPassword) || !/[^A-Za-z0-9]/.test(cleanPassword)) {
      return res.status(400).json({
        error: 'La contrasena debe incluir mayuscula, minuscula, numero y simbolo.',
      });
    }

    try {
      const cuentaExistente = await buscarCuentaLocalExistente(cleanEmail, cleanUsername);
      if (cuentaExistente?.email?.toLowerCase() === cleanEmail) {
        return res.status(400).json({ error: 'El correo ya esta registrado. Inicia sesion.' });
      }
      if (cuentaExistente?.username?.toLowerCase() === cleanUsername) {
        return res.status(400).json({ error: 'Ese nombre de usuario ya esta en uso.' });
      }

      const { user, creadoEnEsteRequest } = await crearUsuarioAuth({
        email: cleanEmail,
        password: cleanPassword,
        username: cleanUsername,
        userType: tipoUsuario,
      });

      authUserId = user.id;
      authCreadoEnEsteRequest = creadoEnEsteRequest;

      const query = `
        INSERT INTO users (id, email, username, user_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            user_type = EXCLUDED.user_type
        RETURNING *`;

      const result = await pool.query(query, [
        authUserId,
        cleanEmail,
        cleanUsername,
        tipoUsuario
      ]);

      programarNotificacionBienvenida(authUserId);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (authUserId && authCreadoEnEsteRequest) {
        await eliminarUsuarioAuthCreado(authUserId);
      }

      if (error.code === '23505') {
        return res.status(400).json({ error: 'El email o nombre de usuario ya esta en uso.' });
      }

      if (error.code === '23514') {
        return res.status(400).json({ error: 'El tipo de usuario no es valido para la base de datos.' });
      }

      if (esUsuarioAuthExistente(error)) {
        return res.status(400).json({ error: 'El correo ya esta registrado.' });
      }

      if (esTimeoutSupabase(error)) {
        return res.status(503).json({ error: 'El servicio de autenticacion tardo demasiado. Proba de nuevo en unos segundos.' });
      }

      console.error('Error al crear cuenta:', error);
      res.status(500).json({ error: 'Error al crear la cuenta.' });
    }
  },

  verificarUsuario: async (req, res) => {
    const userId = req.user.id;

    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        return res.status(200).json({ existe: true, user: result.rows[0] });
      }

      res.status(200).json({ existe: false });
    } catch (error) {
      console.error('Error en verificacion:', error);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
  },

  obtenerConfiguracionActual: async (req, res) => {
    try {
      await asegurarUsuarioPublico(req.user);
      const [configuracion, usuarioResult] = await Promise.all([
        obtenerConfiguracion(req.user.id),
        pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]),
      ]);
      res.json({ ...configuracion, username: usuarioResult.rows[0]?.username || '' });
    } catch (error) {
      console.error('Error al obtener configuracion:', error);
      const mensaje = error.code === '42P01'
        ? 'Falta aplicar la migracion de configuracion en la base de datos.'
        : 'No se pudo cargar la configuracion.';
      res.status(500).json({ error: mensaje });
    }
  },

  actualizarConfiguracionActual: async (req, res) => {
    const validacion = validarConfiguracion(req.body);
    if (validacion.error) return res.status(400).json({ error: validacion.error });

    const c = validacion.configuracion;
    const client = await pool.connect();
    try {
      await asegurarUsuarioPublico(req.user);
      await client.query('BEGIN');
      const usuarioResult = await client.query(
        'SELECT username FROM users WHERE id = $1',
        [req.user.id]
      );
      const result = await client.query(
        `INSERT INTO user_settings (
           user_id, telefono, codigo_pais, idioma, actividad_cuenta,
           notificar_interacciones, notificar_comentarios, notificar_seguidores,
           notificar_publicaciones, notificar_menciones, reducir_movimiento,
           mostrar_email, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
           timezone('utc'::text, now())
         )
         ON CONFLICT (user_id) DO UPDATE SET
           telefono = EXCLUDED.telefono,
           codigo_pais = EXCLUDED.codigo_pais,
           idioma = EXCLUDED.idioma,
           actividad_cuenta = EXCLUDED.actividad_cuenta,
           notificar_interacciones = EXCLUDED.notificar_interacciones,
           notificar_comentarios = EXCLUDED.notificar_comentarios,
           notificar_seguidores = EXCLUDED.notificar_seguidores,
           notificar_publicaciones = EXCLUDED.notificar_publicaciones,
           notificar_menciones = EXCLUDED.notificar_menciones,
           reducir_movimiento = EXCLUDED.reducir_movimiento,
           mostrar_email = EXCLUDED.mostrar_email,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          req.user.id, c.telefono, c.codigoPais, c.idioma, c.actividadCuenta,
          c.notificarInteracciones, c.notificarComentarios,
          c.notificarSeguidores, c.notificarPublicaciones, c.notificarMenciones,
          c.reducirMovimiento, c.mostrarEmail,
        ]
      );

      const username = usuarioResult.rows[0]?.username || '';
      const configuracion = { ...mapearConfiguracion(result.rows[0]), username };
      await client.query('COMMIT');
      const metadata = { ...(req.user.user_metadata || {}), username, configuracion };
      const { error: authError } = await supabase.auth.admin.updateUserById(req.user.id, {
        user_metadata: metadata,
      });
      if (authError) console.error('No se pudo sincronizar metadata de configuracion:', authError);

      res.json(configuracion);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al actualizar configuracion:', error);
      const mensaje = error.code === '42P01'
        ? 'Falta aplicar la migracion de configuracion en la base de datos.'
        : 'No se pudo guardar la configuracion.';
      res.status(500).json({ error: mensaje });
    } finally {
      client.release();
    }
  },

  exportarDatosActuales: async (req, res) => {
    try {
      await asegurarUsuarioPublico(req.user);
      const consultas = {
        cuenta: ['SELECT * FROM users WHERE id = $1', [req.user.id]],
        configuracion: ['SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]],
        reels: ['SELECT * FROM reels WHERE creador_id = $1 ORDER BY created_at DESC', [req.user.id]],
        eventos: ['SELECT * FROM eventos WHERE creador_id = $1 ORDER BY created_at DESC', [req.user.id]],
        seguimientos: ['SELECT * FROM follows WHERE follower_id = $1 OR following_id = $1', [req.user.id]],
        reels_que_gustan: ['SELECT * FROM reel_likes WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        reels_compartidos: ['SELECT * FROM reel_shares WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        eventos_guardados: ['SELECT * FROM event_saves WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        comentarios_reels: ['SELECT * FROM reel_comments WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        publicaciones_foros: ['SELECT * FROM comunidad_publicaciones WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        membresias_foros: ['SELECT * FROM comunidad_miembros WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        comentarios_foros: ['SELECT * FROM comunidad_comentarios WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        likes_foros: ['SELECT * FROM comunidad_publicacion_likes WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        guardados_foros: ['SELECT * FROM comunidad_publicacion_guardados WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        publicaciones_comunidad_perfil: ['SELECT * FROM perfil_comunidad_publicaciones WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        respuestas_comunidad_perfil: ['SELECT * FROM perfil_comunidad_respuestas WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        notificaciones: ['SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
        usuarios_silenciados: ['SELECT * FROM notification_mutes WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]],
      };
      const datos = {};
      await Promise.all(Object.entries(consultas).map(async ([clave, [query, params]]) => {
        const result = await consultarOpcional(query, params);
        datos[clave] = clave === 'cuenta' ? (result.rows[0] || null) : result.rows;
      }));
      datos.configuracion = mapearConfiguracion(datos.configuracion[0]);

      res.json({
        exportado_en: new Date().toISOString(),
        autenticacion: {
          id: req.user.id,
          email: req.user.email,
          telefono: req.user.phone || null,
          creada_en: req.user.created_at,
          ultimo_acceso: req.user.last_sign_in_at,
        },
        ...datos,
      });
    } catch (error) {
      console.error('Error al exportar datos:', error);
      res.status(500).json({ error: 'No se pudieron preparar tus datos.' });
    }
  },

  obtenerPerfilActual: async (req, res) => {
    try {
      await asegurarUsuarioPublico(req.user);
      const datosPerfil = await obtenerDatosPerfil(req.user.id, req.user.id);
      res.json(datosPerfil);
    } catch (error) {
      console.error('Error al obtener perfil actual:', error);
      res.status(500).json({ error: 'No se pudo cargar el perfil.' });
    }
  },

  completarOnboarding: async (req, res) => {
    const nombre = String(req.body?.nombre || '').trim();
    const bio = String(req.body?.bio || '').trim();
    if (nombre.length < 2 || nombre.length > 32) {
      return res.status(400).json({ error: 'El nombre visible debe tener entre 2 y 32 caracteres.' });
    }
    if (bio.length > 180) {
      return res.status(400).json({ error: 'La bio no puede superar los 180 caracteres.' });
    }
    const validacion = validarFechaNacimiento(req.body?.birthDate);
    if (validacion.error) return res.status(400).json({ error: validacion.error });
    const validacionGeneros = validarGenerosOnboarding(req.body?.genres);
    if (validacionGeneros.error) return res.status(400).json({ error: validacionGeneros.error });

    let avatarSubido = null;
    let avatarAdvertencia = null;
    const client = await pool.connect();
    try {
      await asegurarUsuarioPublico(req.user);
      const perfilAnterior = await client.query(
        'SELECT profile_img_path FROM users WHERE id = $1',
        [req.user.id]
      );
      const avatarOpcional = await subirAvatarOpcional(req.file, req.user.id, 'onboarding', req.accessToken);
      avatarSubido = avatarOpcional.avatar;
      avatarAdvertencia = avatarOpcional.advertencia;

      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE users
         SET display_name = $1,
             bio = $2,
             birth_date = $3,
             profile_img_url = COALESCE($4, profile_img_url),
             profile_img_path = COALESCE($5, profile_img_path),
             updated_at = timezone('utc'::text, now())
         WHERE id = $6
         RETURNING id, username, display_name, bio, profile_img_url, birth_date`,
        [
          nombre,
          bio,
          validacion.birthDate,
          avatarSubido?.publicUrl || null,
          avatarSubido?.path || null,
          req.user.id,
        ]
      );
      await client.query('DELETE FROM user_interests WHERE user_id = $1', [req.user.id]);
      await client.query(
        `INSERT INTO user_interests (user_id, genre)
         SELECT $1, unnest($2::text[])`,
        [req.user.id, validacionGeneros.generos]
      );
      await client.query('COMMIT');

      const avatarAnteriorPath = perfilAnterior.rows[0]?.profile_img_path;
      if (avatarSubido?.path && avatarAnteriorPath && avatarAnteriorPath !== avatarSubido.path) {
        await eliminarAvatarUsuario(avatarAnteriorPath, req.accessToken).catch(() => null);
      }

      res.json({
        ok: true,
        perfil: {
          id: result.rows[0].id,
          username: result.rows[0].username,
          nombre: result.rows[0].display_name || result.rows[0].username,
          bio: result.rows[0].bio || '',
          avatar: result.rows[0].profile_img_url || '',
        },
        birthDate: result.rows[0].birth_date,
        genres: validacionGeneros.generos,
        avatarWarning: avatarAdvertencia,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      if (avatarSubido?.path) await eliminarAvatarUsuario(avatarSubido.path, req.accessToken).catch(() => null);
      if (esErrorValidacionArchivo(error)) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Error al completar onboarding:', error);
      res.status(500).json({ error: 'No se pudo completar el perfil.' });
    } finally {
      client.release();
    }
  },

  obtenerPerfilPublico: async (req, res) => {
    const { identificador } = req.params;

    try {
      if (req.user) {
        await asegurarUsuarioPublico(req.user);
      }
      const usuarioEncontrado = await buscarUsuarioPerfil(identificador);

      if (!usuarioEncontrado) {
        return res.status(404).json({ error: 'Perfil no encontrado.' });
      }

      const datosPerfil = await obtenerDatosPerfil(usuarioEncontrado.id, req.user?.id);
      const {
        perfil,
        publicaciones,
        eventos,
        seguidores,
        seguidos,
        siguiendo,
        silenciado,
        stats,
      } = datosPerfil;

      res.json({
        perfil,
        publicaciones,
        eventos,
        seguidores: req.user ? seguidores : [],
        seguidos: req.user ? seguidos : [],
        siguiendo,
        silenciado,
        stats,
      });
    } catch (error) {
      console.error('Error al obtener perfil publico:', error);
      res.status(500).json({ error: 'No se pudo cargar el perfil.' });
    }
  },

  actualizarPerfilActual: async (req, res) => {
    const { nombre, bio, avatar } = req.body;
    const nombreLimpio = nombre?.trim();
    let avatarSubido = null;
    let avatarAdvertencia = null;

    if (!nombreLimpio) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      const perfilAnterior = await pool.query(
        'SELECT profile_img_path FROM users WHERE id = $1',
        [req.user.id]
      );
      const avatarOpcional = await subirAvatarOpcional(req.file, req.user.id, 'perfil', req.accessToken);
      avatarSubido = avatarOpcional.avatar;
      avatarAdvertencia = avatarOpcional.advertencia;
      const avatarUrl = avatarSubido?.publicUrl || (/^https?:\/\//i.test(avatar || '') ? avatar : null);
      const result = await pool.query(
        `UPDATE users
         SET display_name = $1,
             bio = $2,
             profile_img_url = COALESCE($3, profile_img_url),
             profile_img_path = COALESCE($4, profile_img_path),
             updated_at = timezone('utc'::text, now())
         WHERE id = $5
         RETURNING *`,
        [
          nombreLimpio,
          bio || '',
          avatarUrl,
          avatarSubido?.path || null,
          req.user.id,
        ]
      );

      const avatarAnteriorPath = perfilAnterior.rows[0]?.profile_img_path;
      if (avatarSubido?.path && avatarAnteriorPath && avatarAnteriorPath !== avatarSubido.path) {
        await eliminarAvatarUsuario(avatarAnteriorPath, req.accessToken).catch((error) => {
          console.error('No se pudo eliminar el avatar anterior:', error);
        });
      }

      res.json({
        ...mapearUsuarioPerfil(result.rows[0]),
        avatarWarning: avatarAdvertencia,
      });
    } catch (error) {
      if (avatarSubido?.path) {
        await eliminarAvatarUsuario(avatarSubido.path, req.accessToken).catch(() => null);
      }

      if (esErrorValidacionArchivo(error)) {
        return res.status(400).json({ error: error.message });
      }

      if (error.code === '23505') {
        return res.status(400).json({ error: 'Ese nombre de usuario ya esta en uso.' });
      }

      console.error('Error al actualizar perfil:', error);
      res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
    }
  },

  alternarSeguimiento: async (req, res) => {
    const { identificador } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      const usuarioEncontrado = await buscarUsuarioPerfil(identificador);

      if (!usuarioEncontrado) {
        return res.status(404).json({ error: 'Perfil no encontrado.' });
      }

      if (usuarioEncontrado.id === req.user.id) {
        return res.status(400).json({ error: 'No podes seguir tu propio perfil.' });
      }

      await asegurarEsquemaModeracion();
      const bloqueo = await client.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [req.user.id, usuarioEncontrado.id]
      );
      if (bloqueo.rowCount > 0) {
        return res.status(400).json({ error: 'No podes seguir una cuenta bloqueada.' });
      }

      await client.query('BEGIN');
      const existe = await client.query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [req.user.id, usuarioEncontrado.id]
      );

      let siguiendo = false;

      if (existe.rowCount > 0) {
        await client.query(
          'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
          [req.user.id, usuarioEncontrado.id]
        );
        await eliminarNotificacion(`follow:${req.user.id}:${usuarioEncontrado.id}`, client);
      } else {
        await client.query(
          'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
          [req.user.id, usuarioEncontrado.id]
        );
        siguiendo = true;
        await crearNotificacion({
          userId: usuarioEncontrado.id,
          actorId: req.user.id,
          type: 'follow',
          title: 'Tenes un nuevo seguidor',
          body: `${nombreActor(req.user)} empezo a seguirte.`,
          targetUrl: `/perfil/${req.user.id}`,
          entityType: 'profile',
          entityId: req.user.id,
          uniqueKey: `follow:${req.user.id}:${usuarioEncontrado.id}`,
        }, client);
      }

      const counts = await client.query(
        `SELECT
          (SELECT COUNT(*)::int FROM follows WHERE following_id = $1) AS seguidores,
          (SELECT COUNT(*)::int FROM follows WHERE follower_id = $2) AS mis_seguidos`,
        [usuarioEncontrado.id, req.user.id]
      );

      await client.query('COMMIT');

      res.json({
        siguiendo,
        seguidores: Number(counts.rows[0]?.seguidores || 0),
        misSeguidos: Number(counts.rows[0]?.mis_seguidos || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar seguimiento:', error);
      res.status(500).json({ error: 'No se pudo actualizar el seguimiento.' });
    } finally {
      client.release();
    }
  },

  listarBloqueadosActuales: async (req, res) => {
    try {
      await asegurarEsquemaModeracion();
      const result = await pool.query(
        `SELECT u.*
         FROM user_blocks ub
         JOIN users u ON u.id = ub.blocked_id
         WHERE ub.blocker_id = $1
         ORDER BY ub.created_at DESC`,
        [req.user.id]
      );
      res.json(result.rows.map((usuario) => mapearUsuarioPerfil(usuario)));
    } catch (error) {
      console.error('Error al listar cuentas bloqueadas:', error);
      res.status(500).json({ error: 'No se pudieron cargar las cuentas bloqueadas.' });
    }
  },

  bloquearUsuario: async (req, res) => {
    const { identificador } = req.params;
    const client = await pool.connect();
    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaModeracion();
      const usuarioEncontrado = await buscarUsuarioPerfil(identificador);
      if (!usuarioEncontrado) return res.status(404).json({ error: 'Perfil no encontrado.' });
      if (usuarioEncontrado.id === req.user.id) {
        return res.status(400).json({ error: 'No podes bloquear tu propia cuenta.' });
      }

      await client.query('BEGIN');
      await client.query(
        `INSERT INTO user_blocks (blocker_id, blocked_id)
         VALUES ($1, $2)
         ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [req.user.id, usuarioEncontrado.id]
      );
      await client.query(
        `DELETE FROM follows
         WHERE (follower_id = $1 AND following_id = $2)
            OR (follower_id = $2 AND following_id = $1)`,
        [req.user.id, usuarioEncontrado.id]
      );
      await eliminarNotificacion(`follow:${req.user.id}:${usuarioEncontrado.id}`, client);
      await eliminarNotificacion(`follow:${usuarioEncontrado.id}:${req.user.id}`, client);
      await client.query(
        `DELETE FROM notification_mutes
         WHERE (user_id = $1 AND muted_user_id = $2)
            OR (user_id = $2 AND muted_user_id = $1)`,
        [req.user.id, usuarioEncontrado.id]
      );
      await client.query('COMMIT');
      res.json({ bloqueado: true, usuario: mapearUsuarioPerfil(usuarioEncontrado) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al bloquear usuario:', error);
      res.status(500).json({ error: 'No se pudo bloquear la cuenta.' });
    } finally {
      client.release();
    }
  },

  desbloquearUsuario: async (req, res) => {
    const { identificador } = req.params;
    try {
      await asegurarEsquemaModeracion();
      const usuarioEncontrado = await buscarUsuarioPerfil(identificador);
      if (!usuarioEncontrado) return res.status(404).json({ error: 'Perfil no encontrado.' });
      await pool.query(
        'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
        [req.user.id, usuarioEncontrado.id]
      );
      res.json({ bloqueado: false });
    } catch (error) {
      console.error('Error al desbloquear usuario:', error);
      res.status(500).json({ error: 'No se pudo desbloquear la cuenta.' });
    }
  },

  denunciarPerfil: async (req, res) => {
    const { identificador } = req.params;
    try {
      const usuarioEncontrado = await buscarUsuarioPerfil(identificador);
      if (!usuarioEncontrado) return res.status(404).json({ error: 'Perfil no encontrado.' });
      const resultado = await registrarDenuncia({
        reporterId: req.user.id,
        reportedUserId: usuarioEncontrado.id,
        contentType: 'perfil',
        contentId: usuarioEncontrado.id,
        reason: req.body?.reason,
        details: req.body?.detail,
      });
      res.json(resultado);
    } catch (error) {
      console.error('Error al denunciar perfil:', error);
      res.status(error.status || 500).json({ error: error.message || 'No se pudo denunciar el perfil.' });
    }
  },

  alternarSilencioNotificaciones: async (req, res) => {
    const { identificador } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      const usuarioEncontrado = await buscarUsuarioPerfil(identificador);
      if (!usuarioEncontrado) return res.status(404).json({ error: 'Perfil no encontrado.' });
      if (usuarioEncontrado.id === req.user.id) {
        return res.status(400).json({ error: 'No podes silenciar tu propio perfil.' });
      }

      await client.query('BEGIN');
      const seguimiento = await client.query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [req.user.id, usuarioEncontrado.id]
      );
      if (seguimiento.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Solo podes silenciar usuarios que seguis.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM notification_mutes WHERE user_id = $1 AND muted_user_id = $2',
        [req.user.id, usuarioEncontrado.id]
      );
      const silenciado = existe.rowCount === 0;
      if (silenciado) {
        await client.query(
          'INSERT INTO notification_mutes (user_id, muted_user_id) VALUES ($1, $2)',
          [req.user.id, usuarioEncontrado.id]
        );
      } else {
        await client.query(
          'DELETE FROM notification_mutes WHERE user_id = $1 AND muted_user_id = $2',
          [req.user.id, usuarioEncontrado.id]
        );
      }

      await client.query('COMMIT');
      res.json({ silenciado });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar silencio:', error);
      res.status(500).json({ error: 'No se pudo actualizar el silencio de notificaciones.' });
    } finally {
      client.release();
    }
  },

  listarSeguidosActuales: async (req, res) => {
    try {
      await asegurarUsuarioPublico(req.user);
      const result = await consultarOpcional(
        `SELECT u.*
         FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = $1
         ORDER BY f.created_at DESC`,
        [req.user.id]
      );

      res.json(result.rows.map(mapearUsuarioPerfil));
    } catch (error) {
      console.error('Error al listar seguidos:', error);
      res.status(500).json({ error: 'No se pudieron cargar los seguidos.' });
    }
  },

  registrarUsuario: async (req, res) => {
    const userId = req.user.id;
    const email = req.user.email;
    const { username, user_type } = req.body;
    const tipoUsuario = user_type || process.env.DEFAULT_USER_TYPE || 'musico';

    if (!username) {
      return res.status(400).json({ error: 'El nombre de usuario es obligatorio.' });
    }
    const validacionUsername = validarUsername(username);
    if (validacionUsername.error) return res.status(400).json({ error: validacionUsername.error });

    try {
      const query = `
        INSERT INTO users (id, email, username, user_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            user_type = EXCLUDED.user_type
        RETURNING *`;

      const result = await pool.query(query, [
        userId,
        email,
        validacionUsername.username,
        tipoUsuario
      ]);

      programarNotificacionBienvenida(userId);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'El email o nombre de usuario ya esta en uso.' });
      }

      if (error.code === '23514') {
        return res.status(400).json({ error: 'El tipo de usuario no es valido para la base de datos.' });
      }

      console.error('Error al registrar usuario:', error);
      res.status(500).json({ error: 'Error al crear la cuenta.' });
    }
  },

  convertirAMusico: async (req, res) => {
    const userId = req.user.id;
    const { genero, bio } = req.body;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET user_type = $1 WHERE id = $2', ['musico', userId]);
      await client.query('COMMIT');

      res.json({
        success: true,
        mensaje: 'Perfil de musico activado.',
        perfil: { genero, bio }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error al convertir usuario a musico:', error);
      res.status(500).json({ error: 'No se pudo procesar la conversion.' });
    } finally {
      client.release();
    }
  },

  eliminarCuentaActual: async (req, res) => {
    const userId = req.user.id;
    const password = String(req.body?.password || '');

    if (!password) {
      return res.status(400).json({ error: 'Ingresa tu contrasena para eliminar la cuenta.' });
    }

    try {
      const { data: acceso, error: loginError } = await supabaseAuth.auth.signInWithPassword({
        email: req.user.email,
        password,
      });
      if (loginError || acceso.user?.id !== userId) {
        return res.status(401).json({ error: 'La contrasena es incorrecta.' });
      }

      const [perfil, eventos, reels] = await Promise.all([
        pool.query('SELECT profile_img_path, profile_img_url FROM users WHERE id = $1', [userId]),
        pool.query('SELECT img_path, img_url FROM eventos WHERE creador_id = $1', [userId]),
        pool.query('SELECT portada_path, portada_url, audio_path, audio_url FROM reels WHERE creador_id = $1', [userId]),
      ]);

      const eliminacionesStorage = [
        eliminarAvatarUsuario(
          perfil.rows[0]?.profile_img_path
            || extraerRutaPublica(perfil.rows[0]?.profile_img_url, PERFILES_BUCKET),
          req.accessToken
        ),
        ...eventos.rows.map((evento) => eliminarImagenEvento(
          evento.img_path || extraerRutaPublica(evento.img_url, EVENTOS_BUCKET),
          req.accessToken
        )),
        ...reels.rows.flatMap((reel) => [
          eliminarArchivoReel(reel.portada_path || extraerRutaPublica(reel.portada_url, REELS_BUCKET), req.accessToken),
          eliminarArchivoReel(reel.audio_path || extraerRutaPublica(reel.audio_url, REELS_BUCKET), req.accessToken),
        ]),
      ];
      await Promise.all(eliminacionesStorage);

      await eliminarUsuarioAuthCreado(userId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      res.status(500).json({ error: 'No se pudo eliminar la cuenta.' });
    }
  }
};

module.exports = usuariosController;
