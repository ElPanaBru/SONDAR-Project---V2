const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const {
  subirPortadaReel,
  subirAudioReel,
  eliminarArchivoReel
} = require('../services/storageService');

let esquemaComentariosListo = null;
let esquemaCompartidosListo = null;

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

function mapearReel(reel) {
  return {
    id: reel.id,
    artista: reel.creador_nombre || reel.creador_email?.split('@')[0] || 'Artista SONDAR',
    usuario: reel.creador_email ? `@${reel.creador_email.split('@')[0]}` : '@artista',
    oyentes: '0',
    tema: reel.titulo,
    album: reel.album,
    genero: reel.genero,
    descripcion: reel.descripcion,
    duracion: reel.duracion || '0:30',
    progreso: 0,
    likes: Number(reel.likes || 0),
    comentarios: '0',
    compartidos: Number(reel.compartidos || 0),
    guardados: Number(reel.guardados || 0),
    colorA: '#ffae00',
    colorB: '#ff5e00',
    colorC: '#111111',
    portada: reel.portada_url,
    audio: reel.audio_url,
    avatar: reel.creador_avatar || reel.profile_img_url || '',
    liked: false,
    guardado: false,
    siguiendo: false,
    creadorId: reel.creador_id,
    backendId: reel.id
  };
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
    likes: Number(row.likes || 0),
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
      const viewerId = await obtenerViewerId(req);
      const result = await pool.query(`
        SELECT
          r.*,
          COALESCE(u.username, u.email) AS creador_nombre,
          u.email AS creador_email,
          u.profile_img_url AS creador_avatar
        FROM reels r
        LEFT JOIN users u ON u.id = r.creador_id
        ORDER BY r.created_at DESC, r.id DESC
      `);

      if (!viewerId || result.rows.length === 0) {
        return res.json(result.rows.map(mapearReel));
      }

      const reelIds = result.rows.map((reel) => reel.id);
      const creadorIds = [...new Set(result.rows.map((reel) => reel.creador_id).filter(Boolean))];
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

      res.json(result.rows.map((reel) => ({
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

  listarComentarios: async (req, res) => {
    const { id } = req.params;

    try {
      await asegurarEsquemaComentarios();
      const viewerId = await obtenerViewerId(req);
      const result = await pool.query(
        `SELECT
          rc.*,
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

      const result = await pool.query(
        `INSERT INTO reel_comments (reel_id, user_id, parent_id, texto, responde_a)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, req.user.id, parentId || null, textoLimpio, parentId ? respondeALimpio : null]
      );

      const usuarioResult = await pool.query(
        'SELECT username, email, profile_img_url FROM users WHERE id = $1',
        [req.user.id]
      );

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
      portadaSubida = await subirPortadaReel(portadaFile);
      audioSubido = await subirAudioReel(audioFile);

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
        'SELECT profile_img_url FROM users WHERE id = $1',
        [req.user.id]
      );

      res.status(201).json(mapearReel({
        ...result.rows[0],
        creador_nombre: req.user.user_metadata?.username || req.user.email?.split('@')[0],
        creador_email: req.user.email,
        creador_avatar: usuarioResult.rows[0]?.profile_img_url || ''
      }));
    } catch (error) {
      await eliminarArchivoReel(portadaSubida?.path).catch(() => null);
      await eliminarArchivoReel(audioSubido?.path).catch(() => null);
      console.error('Error al crear reel:', error);
      res.status(500).json({ error: error.message || 'No se pudo guardar el reel.' });
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

      await eliminarArchivoReel(result.rows[0].portada_path).catch(() => null);
      await eliminarArchivoReel(result.rows[0].audio_path).catch(() => null);
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

      const reel = await client.query('SELECT id FROM reels WHERE id = $1', [id]);
      if (reel.rowCount === 0) {
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
        await client.query('UPDATE reels SET likes = GREATEST(0, likes - 1) WHERE id = $1', [id]);
      } else {
        await client.query('INSERT INTO reel_likes (user_id, reel_id) VALUES ($1, $2)', [req.user.id, id]);
        await client.query('UPDATE reels SET likes = likes + 1 WHERE id = $1', [id]);
        liked = true;
      }

      const counts = await client.query('SELECT likes FROM reels WHERE id = $1', [id]);
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

      const comentario = await client.query(
        'SELECT id FROM reel_comments WHERE id = $1',
        [comentarioId]
      );
      if (comentario.rowCount === 0) {
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
        await client.query(
          'UPDATE reel_comments SET likes = GREATEST(0, likes - 1) WHERE id = $1',
          [comentarioId]
        );
      } else {
        await client.query(
          'INSERT INTO reel_comment_likes (user_id, comment_id) VALUES ($1, $2)',
          [req.user.id, comentarioId]
        );
        await client.query(
          'UPDATE reel_comments SET likes = likes + 1 WHERE id = $1',
          [comentarioId]
        );
        liked = true;
      }

      const counts = await client.query('SELECT likes FROM reel_comments WHERE id = $1', [comentarioId]);
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

      const reel = await client.query('SELECT id FROM reels WHERE id = $1', [id]);
      if (reel.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reel no encontrado.' });
      }

      const compartido = await client.query(
        `INSERT INTO reel_shares (user_id, reel_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, reel_id) DO NOTHING
         RETURNING reel_id`,
        [req.user.id, id]
      );

      const counts = await client.query(
        `UPDATE reels
         SET compartidos = (SELECT COUNT(*)::int FROM reel_shares WHERE reel_id = $1)
         WHERE id = $1
         RETURNING compartidos`,
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

      const reel = await client.query('SELECT id FROM reels WHERE id = $1', [id]);
      if (reel.rowCount === 0) {
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
        await client.query('UPDATE reels SET guardados = GREATEST(0, guardados - 1) WHERE id = $1', [id]);
      } else {
        await client.query('INSERT INTO reel_saves (user_id, reel_id) VALUES ($1, $2)', [req.user.id, id]);
        await client.query('UPDATE reels SET guardados = guardados + 1 WHERE id = $1', [id]);
        guardado = true;
      }

      const counts = await client.query('SELECT guardados FROM reels WHERE id = $1', [id]);
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
