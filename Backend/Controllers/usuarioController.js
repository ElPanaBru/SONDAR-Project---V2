const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const {
  subirAvatarUsuario,
  eliminarAvatarUsuario,
  eliminarImagenEvento,
  eliminarArchivoReel,
} = require('../services/storageService');

function nombreVisible(usuario) {
  return (
    usuario?.artist_name ||
    usuario?.full_name ||
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

function mapearUsuarioPerfil(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    username: usuario.username,
    user_type: usuario.user_type,
    nombre: nombreVisible(usuario),
    usuario: usuarioVisible(usuario),
    bio: usuario.bio || usuario.artist_bio || 'Artista en SONDAR.',
    avatar: usuario.profile_img_url || '',
    banner: usuario.banner_url || '',
    instagram: usuario.instagram_url || '',
    verificado: Boolean(usuario.verified),
  };
}

function mapearUsuarioBusqueda(usuario, stats = {}) {
  return {
    id: usuario.id,
    username: usuario.username,
    user_type: usuario.user_type,
    nombre: nombreVisible(usuario),
    usuario: usuarioVisible(usuario),
    bio: usuario.bio || usuario.artist_bio || 'Artista en SONDAR.',
    avatar: usuario.profile_img_url || '',
    banner: usuario.banner_url || '',
    verificado: Boolean(usuario.verified),
    seguidores: Number(stats.seguidores || 0),
    publicaciones: Number(stats.publicaciones || 0),
  };
}

function mapearReelPerfil(reel) {
  return {
    id: reel.id,
    tipo: 'reel',
    nombre: reel.titulo,
    detalle: `${reel.album || 'Reel'}${reel.duracion ? ` - ${reel.duracion}` : ''}`,
    imagen: reel.portada_url || '',
    audio: reel.audio_url || '',
    genero: reel.genero || '',
    descripcion: reel.descripcion || '',
    creadorId: reel.creador_id,
  };
}

function mapearEventoPerfil(evento) {
  return {
    id: evento.id,
    tipo: 'evento',
    nombre: evento.titulo,
    detalle: evento.lugar || 'Evento',
    imagen: evento.img_url || '',
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
  const [usuarioResult, reelsResult, eventosResult, publicacionesStatsResult] = await Promise.all([
    pool.query('SELECT * FROM users WHERE id = $1', [targetUserId]),
    pool.query(
      `SELECT * FROM reels
       WHERE creador_id = $1
       ORDER BY created_at DESC, id DESC`,
      [targetUserId]
    ),
    pool.query(
      `SELECT * FROM eventos
       WHERE creador_id = $1
       ORDER BY fecha DESC, id DESC`,
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
    reelsGuardadosResult,
    eventosGuardadosResult,
    seguidoresStatsResult,
    seguidosStatsResult,
    siguiendoResult,
    seguidoresResult,
    seguidosResult,
  ] = await Promise.all([
    consultarOpcional(
      `SELECT r.*
       FROM reel_likes rl
       JOIN reels r ON r.id = rl.reel_id
       WHERE rl.user_id = $1
       ORDER BY rl.created_at DESC`,
      [targetUserId]
    ),
    consultarOpcional(
      `SELECT r.*
       FROM reel_saves rs
       JOIN reels r ON r.id = rs.reel_id
       WHERE rs.user_id = $1
       ORDER BY rs.created_at DESC`,
      [targetUserId]
    ),
    consultarOpcional(
      `SELECT e.*
       FROM event_saves es
       JOIN eventos e ON e.id = es.event_id
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
  const reels = reelsResult.rows.map(mapearReelPerfil);
  const eventos = eventosResult.rows.map(mapearEventoPerfil);
  const reelsGuardados = reelsGuardadosResult.rows.map((reel) => ({
    ...mapearReelPerfil(reel),
    guardadoTipo: 'reel',
  }));
  const eventosGuardados = eventosGuardadosResult.rows.map((evento) => ({
    ...mapearEventoPerfil(evento),
    guardadoTipo: 'evento',
  }));

  return {
    perfil: mapearUsuarioPerfil(usuario),
    publicaciones: reels,
    eventos,
    favoritos: favoritosResult.rows.map(mapearReelPerfil),
    guardados: [...reelsGuardados, ...eventosGuardados],
    seguidores: seguidoresResult.rows.map(mapearUsuarioPerfil),
    seguidos: seguidosResult.rows.map(mapearUsuarioPerfil),
    siguiendo: Boolean(siguiendoResult.rows[0]?.siguiendo),
    stats: {
      publicaciones: Number(publicacionesStats.reels || 0) + Number(publicacionesStats.eventos || 0),
      reels: Number(publicacionesStats.reels || 0),
      eventos: Number(publicacionesStats.eventos || 0),
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
          COALESCE(full_name, '') ILIKE $1 OR
          COALESCE(artist_name, '') ILIKE $1 OR
          COALESCE(bio, '') ILIKE $1 OR
          COALESCE(artist_bio, '') ILIKE $1
         ORDER BY
          CASE
            WHEN lower(username) = lower($2) THEN 0
            WHEN lower(COALESCE(artist_name, full_name, username)) = lower($2) THEN 1
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
    const cleanUsername = username?.trim();
    const cleanPassword = password?.trim();
    const tipoUsuario = user_type || process.env.DEFAULT_USER_TYPE || 'musico';
    let authUserId = null;

    if (!cleanEmail || !cleanPassword || !cleanUsername) {
      return res.status(400).json({ error: 'Email, contrasena y nombre de usuario son obligatorios.' });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });
    }

    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          username: cleanUsername
        }
      });

      if (error) {
        throw error;
      }

      authUserId = data.user.id;

      const query = `
        INSERT INTO users (id, email, username, user_type)
        VALUES ($1, $2, $3, $4)
        RETURNING *`;

      const result = await pool.query(query, [
        authUserId,
        cleanEmail,
        cleanUsername,
        tipoUsuario
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (authUserId) {
        await supabase.auth.admin.deleteUser(authUserId).catch(() => null);
      }

      if (error.code === '23505') {
        return res.status(400).json({ error: 'El email o nombre de usuario ya esta en uso.' });
      }

      if (error.code === '23514') {
        return res.status(400).json({ error: 'El tipo de usuario no es valido para la base de datos.' });
      }

      if (error.message?.includes('already been registered')) {
        return res.status(400).json({ error: 'El correo ya esta registrado.' });
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
        stats,
      } = datosPerfil;

      res.json({
        perfil,
        publicaciones,
        eventos,
        seguidores: req.user ? seguidores : [],
        seguidos: req.user ? seguidos : [],
        siguiendo,
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

    if (!nombreLimpio) {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      const perfilAnterior = await pool.query(
        'SELECT profile_img_path FROM users WHERE id = $1',
        [req.user.id]
      );
      avatarSubido = await subirAvatarUsuario(req.file, req.user.id);
      const avatarUrl = avatarSubido?.publicUrl || (/^https?:\/\//i.test(avatar || '') ? avatar : null);
      const result = await pool.query(
        `UPDATE users
         SET full_name = $1,
             artist_name = $1,
             username = $2,
             bio = $3,
             profile_img_url = COALESCE($4, profile_img_url),
             profile_img_path = COALESCE($5, profile_img_path),
             updated_at = timezone('utc'::text, now())
         WHERE id = $6
         RETURNING *`,
        [
          nombreLimpio,
          nombreLimpio.toLowerCase().replace(/\s+/g, '_').slice(0, 40),
          bio || '',
          avatarUrl,
          avatarSubido?.path || null,
          req.user.id,
        ]
      );

      const avatarAnteriorPath = perfilAnterior.rows[0]?.profile_img_path;
      if (avatarSubido?.path && avatarAnteriorPath && avatarAnteriorPath !== avatarSubido.path) {
        await eliminarAvatarUsuario(avatarAnteriorPath).catch((error) => {
          console.error('No se pudo eliminar el avatar anterior:', error);
        });
      }

      res.json(mapearUsuarioPerfil(result.rows[0]));
    } catch (error) {
      if (avatarSubido?.path) {
        await eliminarAvatarUsuario(avatarSubido.path).catch(() => null);
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
      } else {
        await client.query(
          'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)',
          [req.user.id, usuarioEncontrado.id]
        );
        siguiendo = true;
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

    try {
      const query = `
        INSERT INTO users (id, email, username, user_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            username = EXCLUDED.username,
            user_type = EXCLUDED.user_type
        RETURNING *`;

      const result = await pool.query(query, [
        userId,
        email,
        username,
        tipoUsuario
      ]);

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

    try {
      const [perfil, eventos, reels] = await Promise.all([
        pool.query('SELECT profile_img_path FROM users WHERE id = $1', [userId]),
        pool.query('SELECT img_path FROM eventos WHERE creador_id = $1', [userId]),
        pool.query('SELECT portada_path, audio_path FROM reels WHERE creador_id = $1', [userId]),
      ]);

      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        throw new Error(error.message);
      }

      const eliminacionesStorage = [
        eliminarAvatarUsuario(perfil.rows[0]?.profile_img_path),
        ...eventos.rows.map((evento) => eliminarImagenEvento(evento.img_path)),
        ...reels.rows.flatMap((reel) => [
          eliminarArchivoReel(reel.portada_path),
          eliminarArchivoReel(reel.audio_path),
        ]),
      ];
      await Promise.allSettled(eliminacionesStorage);

      res.json({ success: true });
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      res.status(500).json({ error: 'No se pudo eliminar la cuenta.' });
    }
  }
};

module.exports = usuariosController;
