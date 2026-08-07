const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const {
  crearNotificacion,
  eliminarNotificacion,
  nombreActor,
  notificarMenciones,
  notificarSeguidores,
} = require('../services/notificationService');
const { enteroLimitado, textoLimitado } = require('../domain/validacion');

const COMUNIDADES_GENERO = [
  {
    id: 'pop',
    nombre: '@pop',
    titulo: 'Pop',
    genero: 'pop',
    descripcion: 'Charlas, lanzamientos, preguntas y recomendaciones para la escena pop de SONDAR.',
    portada: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'rock',
    nombre: '@rock',
    titulo: 'Rock',
    genero: 'rock',
    descripcion: 'Guitarras, fechas, bandas nuevas, demos y conversaciones de la comunidad rock.',
    portada: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'edm',
    nombre: '@edm',
    titulo: 'EDM',
    genero: 'edm',
    descripcion: 'Sets, drops, produccion, festivales y novedades de la comunidad EDM.',
    portada: 'https://images.unsplash.com/photo-1571266028243-d220c9c3b8ef?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'jazz',
    nombre: '@jazz',
    titulo: 'Jazz',
    genero: 'jazz',
    descripcion: 'Improvisacion, standards, jams, discos y encuentros para oyentes y musicos de jazz.',
    portada: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'blues',
    nombre: '@blues',
    titulo: 'Blues',
    genero: 'blues',
    descripcion: 'Riffs, armonicas, zapadas, fechas y recomendaciones para quienes siguen el blues.',
    portada: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'cumbia',
    nombre: '@cumbia',
    titulo: 'Cumbia',
    genero: 'cumbia',
    descripcion: 'Bandas, bailes, estrenos, eventos y charla abierta para la comunidad cumbiera.',
    portada: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'trap',
    nombre: '@trap',
    titulo: 'Trap',
    genero: 'trap',
    descripcion: 'Beats, barras, productores, lanzamientos y debates de la escena trap.',
    portada: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'metal',
    nombre: '@metal',
    titulo: 'Metal',
    genero: 'metal',
    descripcion: 'Riffs pesados, fechas, discos, bandas emergentes y comunidad metalera.',
    portada: 'https://images.unsplash.com/photo-1508252592163-5d3c3c5599ab?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'folklore',
    nombre: '@folklore',
    titulo: 'Folklore',
    genero: 'folklore',
    descripcion: 'Peñas, canciones, instrumentos, festivales y relatos de la escena folklorica.',
    portada: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1400&q=80',
  },
];

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
  const username = `${baseUsername}`.trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9._-]/g, '').slice(0, 21) || 'usuario';
  const usernameSeguro = `${username}_${user.id.slice(0, 8)}`;

  await pool.query(
    `INSERT INTO users (id, email, username, user_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email
     RETURNING id`,
    [user.id, email, usernameSeguro, 'musico']
  );
}

async function asegurarEsquemaComunidades() {
  // El esquema y los datos base se administran en supabase/migrations.
  return undefined;
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

function usuarioVisible(row) {
  const username = row.username || row.email?.split('@')[0] || 'usuario';
  return `@${String(username).replace(/^@/, '')}`;
}

function mapearComunidad(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    titulo: row.titulo,
    genero: row.genero,
    descripcion: row.descripcion,
    categoria: row.genero,
    miembros: Number(row.miembros || 0),
    publicaciones: Number(row.publicaciones || 0),
    actividad: Number(row.publicaciones || 0) > 0
      ? `${Number(row.publicaciones)} publicaciones`
      : 'Sin publicaciones todavia',
    portada: row.portada_url,
    unido: Boolean(row.unido),
  };
}

function mapearComentario(row) {
  return {
    id: Number(row.id),
    publicacionId: Number(row.publicacion_id),
    userId: row.user_id,
    autor: row.username || row.email?.split('@')[0] || 'Usuario SONDAR',
    usuario: usuarioVisible(row),
    texto: row.texto,
    votos: Number(row.likes_calculados ?? row.likes ?? 0),
    likes: Number(row.likes_calculados ?? row.likes ?? 0),
    liked: Boolean(row.liked),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    tiempo: tiempoRelativo(row.created_at),
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

function mapearPublicacion(row, comentarios = []) {
  return {
    id: Number(row.id),
    comunidadId: row.comunidad_id,
    userId: row.user_id,
    op: row.username || row.email?.split('@')[0] || 'Usuario SONDAR',
    usuario: usuarioVisible(row),
    tipo: row.tipo,
    titulo: row.titulo,
    texto: row.texto,
    etiqueta: row.etiqueta || row.genero,
    eventoAsociadoId: row.evento_asociado_id || null,
    reelAsociadoId: row.reel_asociado_id || null,
    eventoAsociado: row.evento_asociado || null,
    reelAsociado: row.reel_asociado || null,
    votos: Number(row.likes_calculados ?? row.likes ?? 0),
    likes: Number(row.likes_calculados ?? row.likes ?? 0),
    liked: Boolean(row.liked),
    guardado: Boolean(row.guardado),
    comentarios,
    comentariosTotal: Number(row.comentarios_total || comentarios.length),
    tiempo: tiempoRelativo(row.created_at),
  };
}

async function listarComentariosPublicacion(publicacionId, viewerId, limite) {
  const result = await pool.query(
    `SELECT
       cc.*,
       (SELECT COUNT(*)::int FROM comunidad_comentario_likes ccl_count WHERE ccl_count.comentario_id = cc.id) AS likes_calculados,
       u.username,
       u.email,
       EXISTS (
         SELECT 1
         FROM comunidad_comentario_likes ccl
         WHERE ccl.comentario_id = cc.id
           AND ccl.user_id = $2
       ) AS liked
     FROM comunidad_comentarios cc
     LEFT JOIN users u ON u.id = cc.user_id
     WHERE cc.publicacion_id = $1
     ORDER BY cc.created_at ASC, cc.id ASC
     LIMIT $3`,
    [publicacionId, viewerId, limite]
  );
  return anidarComentarios(result.rows);
}

const comunidadController = {
  listarComunidades: async (req, res) => {
    try {
      await asegurarEsquemaComunidades();
      const viewerId = await obtenerViewerId(req);

      const result = await pool.query(`
        SELECT
          c.*,
          COALESCE(publicaciones.total, 0)::int AS publicaciones,
          COALESCE(miembros.total, 0)::int AS miembros,
          EXISTS (
            SELECT 1
            FROM comunidad_miembros cm_viewer
            WHERE cm_viewer.comunidad_id = c.id
              AND cm_viewer.user_id = $2::uuid
          ) AS unido
        FROM comunidades c
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM comunidad_publicaciones cp
          WHERE cp.comunidad_id = c.id
        ) publicaciones ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS total
          FROM comunidad_miembros cm
          WHERE cm.comunidad_id = c.id
        ) miembros ON true
        WHERE c.activa = true
        ORDER BY array_position($1::text[], c.id), c.id
      `, [COMUNIDADES_GENERO.map((comunidad) => comunidad.id), viewerId]);

      res.json(result.rows.map(mapearComunidad));
    } catch (error) {
      console.error('Error al listar comunidades:', error);
      res.status(500).json({ error: 'No se pudieron cargar las comunidades.' });
    }
  },

  alternarMembresia: async (req, res) => {
    const { comunidadId } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await client.query('BEGIN');

      const comunidad = await client.query(
        'SELECT id FROM comunidades WHERE id = $1 AND activa = true',
        [comunidadId]
      );
      if (comunidad.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Foro no encontrado.' });
      }

      const membresia = await client.query(
        'SELECT 1 FROM comunidad_miembros WHERE comunidad_id = $1 AND user_id = $2',
        [comunidadId, req.user.id]
      );

      let unido = false;
      if (membresia.rowCount > 0) {
        await client.query(
          'DELETE FROM comunidad_miembros WHERE comunidad_id = $1 AND user_id = $2',
          [comunidadId, req.user.id]
        );
      } else {
        await client.query(
          'INSERT INTO comunidad_miembros (comunidad_id, user_id) VALUES ($1, $2)',
          [comunidadId, req.user.id]
        );
        unido = true;
      }

      const total = await client.query(
        'SELECT COUNT(*)::int AS miembros FROM comunidad_miembros WHERE comunidad_id = $1',
        [comunidadId]
      );
      await client.query('COMMIT');

      res.json({
        comunidadId,
        unido,
        miembros: Number(total.rows[0]?.miembros || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al actualizar membresia del foro:', error);
      res.status(500).json({ error: 'No se pudo actualizar tu membresia del foro.' });
    } finally {
      client.release();
    }
  },

  establecerMembresia: async (req, res) => {
    const { comunidadId } = req.params;
    const unido = req.method === 'PUT';

    try {
      await asegurarUsuarioPublico(req.user);
      const comunidad = await pool.query(
        'SELECT id FROM comunidades WHERE id = $1 AND activa = true',
        [comunidadId]
      );
      if (comunidad.rowCount === 0) {
        return res.status(404).json({ error: 'Foro no encontrado.' });
      }

      if (unido) {
        await pool.query(
          `INSERT INTO comunidad_miembros (comunidad_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (comunidad_id, user_id) DO NOTHING`,
          [comunidadId, req.user.id]
        );
      } else {
        await pool.query(
          'DELETE FROM comunidad_miembros WHERE comunidad_id = $1 AND user_id = $2',
          [comunidadId, req.user.id]
        );
      }

      const total = await pool.query(
        'SELECT COUNT(*)::int AS miembros FROM comunidad_miembros WHERE comunidad_id = $1',
        [comunidadId]
      );
      return res.json({
        comunidadId,
        unido,
        miembros: Number(total.rows[0]?.miembros || 0),
      });
    } catch (error) {
      console.error('Error al establecer membresia del foro:', error);
      return res.status(500).json({ error: 'No se pudo actualizar tu membresia del foro.' });
    }
  },

  listarPublicaciones: async (req, res) => {
    const { comunidadId } = req.params;
    const filtroRecibido = req.query.filtro || 'destacado';
    const filtro = ['destacado', 'reciente', 'popular', 'preguntas'].includes(filtroRecibido)
      ? filtroRecibido
      : 'destacado';
    const busqueda = `${req.query.q || ''}`.trim().toLowerCase();
    const publicacionId = /^\d+$/.test(String(req.query.publicacionId || ''))
      ? String(req.query.publicacionId)
      : null;
    const limite = enteroLimitado(req.query.limit, { predeterminado: 30, maximo: 50 });

    try {
      await asegurarEsquemaComunidades();
      const viewerId = await obtenerViewerId(req);
      const params = [comunidadId, viewerId];
      const condiciones = ['cp.comunidad_id = $1'];

      if (publicacionId) {
        params.push(publicacionId);
        condiciones.push(`cp.id = $${params.length}`);
      }

      if (filtro === 'preguntas') {
        condiciones.push("cp.tipo = 'preguntas'");
      }

      if (busqueda) {
        params.push(`%${busqueda}%`);
        condiciones.push(`(
          lower(cp.titulo) LIKE $${params.length}
          OR lower(cp.texto) LIKE $${params.length}
          OR lower(COALESCE(cp.etiqueta, '')) LIKE $${params.length}
          OR lower(COALESCE(u.username, '')) LIKE $${params.length}
        )`);
      }

      const orderBy = filtro === 'popular'
        ? 'likes_calculados DESC, comentarios_total DESC, cp.created_at DESC, cp.id DESC'
        : filtro === 'reciente' || filtro === 'preguntas'
          ? 'cp.created_at DESC, cp.id DESC'
          : 'cp.fijada DESC, likes_calculados DESC, comentarios_total DESC, cp.created_at DESC, cp.id DESC';

      params.push(limite);
      const parametroLimite = `$${params.length}`;
      const result = await pool.query(
        `SELECT
           cp.*,
           c.genero,
           u.username,
           u.email,
           CASE WHEN evento_asociado.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', evento_asociado.id,
             'titulo', evento_asociado.titulo,
             'lugar', evento_asociado.lugar,
             'fecha', evento_asociado.fecha,
             'genero', evento_asociado.genero
           ) END AS evento_asociado,
           CASE WHEN reel_asociado.id IS NULL THEN NULL ELSE jsonb_build_object(
             'id', 'db-' || reel_asociado.id::text,
             'backendId', reel_asociado.id,
             'tema', reel_asociado.titulo,
             'album', reel_asociado.album,
             'genero', reel_asociado.genero,
             'portada', reel_asociado.portada_url,
             'audio', reel_asociado.audio_url,
             'artista', COALESCE(creador_reel.display_name, creador_reel.username, 'Artista SONDAR'),
             'usuario', CASE WHEN creador_reel.username IS NULL THEN '@artista' ELSE '@' || regexp_replace(creador_reel.username, '^@', '') END
           ) END AS reel_asociado,
           (SELECT COUNT(*)::int FROM comunidad_publicacion_likes cpl_count WHERE cpl_count.publicacion_id = cp.id) AS likes_calculados,
           (SELECT COUNT(*)::int FROM comunidad_publicacion_guardados cpg_count WHERE cpg_count.publicacion_id = cp.id) AS guardados_calculados,
           EXISTS (
             SELECT 1
             FROM comunidad_publicacion_likes cpl
             WHERE cpl.publicacion_id = cp.id
               AND cpl.user_id = $2
           ) AS liked,
           EXISTS (
             SELECT 1
             FROM comunidad_publicacion_guardados cpg
             WHERE cpg.publicacion_id = cp.id
               AND cpg.user_id = $2
           ) AS guardado,
           (
             SELECT COUNT(*)::int
             FROM comunidad_comentarios cc
             WHERE cc.publicacion_id = cp.id
           ) AS comentarios_total
         FROM comunidad_publicaciones cp
         JOIN comunidades c ON c.id = cp.comunidad_id
         LEFT JOIN users u ON u.id = cp.user_id
         LEFT JOIN eventos evento_asociado ON evento_asociado.id = cp.evento_asociado_id
         LEFT JOIN reels reel_asociado ON reel_asociado.id = cp.reel_asociado_id
         LEFT JOIN users creador_reel ON creador_reel.id = reel_asociado.creador_id
         WHERE ${condiciones.join(' AND ')}
         ORDER BY ${orderBy}
         LIMIT ${parametroLimite}`,
        params
      );

      res.json(result.rows.map((row) => mapearPublicacion(row)));
    } catch (error) {
      console.error('Error al listar publicaciones de comunidad:', error);
      res.status(500).json({ error: 'No se pudieron cargar las publicaciones.' });
    }
  },

  listarComentarios: async (req, res) => {
    const { publicacionId } = req.params;
    const limite = enteroLimitado(req.query.limit, { predeterminado: 100, maximo: 200 });

    try {
      const viewerId = await obtenerViewerId(req);
      const publicacion = await pool.query(
        'SELECT id FROM comunidad_publicaciones WHERE id = $1',
        [publicacionId]
      );
      if (publicacion.rowCount === 0) {
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }

      const comentarios = await listarComentariosPublicacion(publicacionId, viewerId, limite);
      return res.json(comentarios);
    } catch (error) {
      console.error('Error al listar comentarios de comunidad:', error);
      return res.status(500).json({ error: 'No se pudieron cargar los comentarios.' });
    }
  },

  crearPublicacion: async (req, res) => {
    const { comunidadId } = req.params;
    const tituloValidado = textoLimitado(req.body.titulo, { minimo: 1, maximo: 300, campo: 'El titulo' });
    const textoValidado = textoLimitado(req.body.texto, { minimo: 1, maximo: 10000, campo: 'El texto' });
    const etiquetaValidada = textoLimitado(req.body.etiqueta, { minimo: 0, maximo: 40, campo: 'La etiqueta' });
    const titulo = tituloValidado.texto;
    const texto = textoValidado.texto;
    const tipo = req.body.tipo || 'reciente';
    const etiqueta = etiquetaValidada.texto || null;
    const eventoAsociadoId = req.body.eventoAsociadoId ? String(req.body.eventoAsociadoId).trim() : null;
    const reelAsociadoId = req.body.reelAsociadoId ? String(req.body.reelAsociadoId).trim() : null;

    if (tituloValidado.error || textoValidado.error || etiquetaValidada.error) {
      return res.status(400).json({ error: tituloValidado.error || textoValidado.error || etiquetaValidada.error });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();

      const comunidad = await pool.query('SELECT id, genero FROM comunidades WHERE id = $1 AND activa = true', [comunidadId]);
      if (comunidad.rowCount === 0) {
        return res.status(404).json({ error: 'Comunidad no encontrada.' });
      }

      const membresia = await pool.query(
        'SELECT 1 FROM comunidad_miembros WHERE comunidad_id = $1 AND user_id = $2',
        [comunidadId, req.user.id]
      );
      if (membresia.rowCount === 0) {
        return res.status(403).json({ error: 'Unite a este foro antes de crear una publicacion.' });
      }

      const tipoSeguro = tipo === 'preguntas' ? 'preguntas' : 'reciente';
      const reelNormalizado = reelAsociadoId?.replace(/^db-/, '') || null;
      const [eventoAsociado, reelAsociado] = await Promise.all([
        eventoAsociadoId
          ? pool.query('SELECT id FROM eventos WHERE id::text = $1', [eventoAsociadoId])
          : Promise.resolve({ rowCount: 0 }),
        reelNormalizado
          ? pool.query('SELECT id FROM reels WHERE id::text = $1', [reelNormalizado])
          : Promise.resolve({ rowCount: 0 }),
      ]);
      if (eventoAsociadoId && eventoAsociado.rowCount === 0) {
        return res.status(400).json({ error: 'El evento asociado no existe.' });
      }
      if (reelNormalizado && reelAsociado.rowCount === 0) {
        return res.status(400).json({ error: 'El reel asociado no existe.' });
      }
      const result = await pool.query(
        `INSERT INTO comunidad_publicaciones (comunidad_id, user_id, tipo, titulo, texto, etiqueta, evento_asociado_id, reel_asociado_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          comunidadId,
          req.user.id,
          tipoSeguro,
          titulo,
          texto,
          etiqueta || comunidad.rows[0].genero,
          eventoAsociadoId || null,
          reelNormalizado,
        ]
      );

      const usuarioResult = await pool.query(
        `SELECT u.username, u.email
         FROM users u
         WHERE u.id = $1`,
        [req.user.id]
      );

      const actorName = nombreActor(req.user);
      await notificarSeguidores({
        actorId: req.user.id,
        type: 'new_community_post',
        title: `${actorName} publico en una comunidad`,
        body: titulo,
        targetUrl: `/comunidad?comunidad=${comunidadId}&publicacion=${result.rows[0].id}`,
        entityType: 'community_post',
        entityId: result.rows[0].id,
        uniquePrefix: `new-community-post:${result.rows[0].id}`,
      });
      await notificarMenciones({
        texto,
        actorId: req.user.id,
        actorName,
        targetUrl: `/comunidad?comunidad=${comunidadId}&publicacion=${result.rows[0].id}`,
        entityType: 'community_post',
        entityId: result.rows[0].id,
      });

      res.status(201).json(mapearPublicacion({
        ...result.rows[0],
        genero: comunidad.rows[0].genero,
        username: usuarioResult.rows[0]?.username,
        email: usuarioResult.rows[0]?.email || req.user.email,
        liked: false,
        guardado: false,
        comentarios_total: 0,
      }, []));
    } catch (error) {
      console.error('Error al crear publicacion de comunidad:', error);
      res.status(500).json({ error: 'No se pudo publicar en la comunidad.' });
    }
  },

  crearComentario: async (req, res) => {
    const { publicacionId } = req.params;
    const textoValidado = textoLimitado(req.body.texto, { minimo: 1, maximo: 4000, campo: 'El comentario' });
    const texto = textoValidado.texto;
    const parentId = req.body.parentId || null;

    if (textoValidado.error) {
      return res.status(400).json({ error: textoValidado.error });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();

      const publicacion = await pool.query(
        'SELECT id, user_id, titulo, comunidad_id FROM comunidad_publicaciones WHERE id = $1',
        [publicacionId]
      );
      if (publicacion.rowCount === 0) {
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }

      const parentResult = parentId
        ? await pool.query(
          'SELECT user_id FROM comunidad_comentarios WHERE id = $1 AND publicacion_id = $2',
          [parentId, publicacionId]
        )
        : { rows: [], rowCount: 0 };
      if (parentId && parentResult.rowCount === 0) {
        return res.status(400).json({ error: 'La respuesta padre no pertenece a esta publicacion.' });
      }

      const result = await pool.query(
        `INSERT INTO comunidad_comentarios (publicacion_id, user_id, parent_id, texto)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [publicacionId, req.user.id, parentId, texto]
      );

      const usuarioResult = await pool.query(
        `SELECT u.username, u.email
         FROM users u
         WHERE u.id = $1`,
        [req.user.id]
      );

      const receptorId = parentId
        ? parentResult.rows[0]?.user_id
        : publicacion.rows[0].user_id;
      const actorName = nombreActor(req.user);
      const targetUrl = `/comunidad?comunidad=${publicacion.rows[0].comunidad_id}&publicacion=${publicacionId}`;
      await crearNotificacion({
        userId: receptorId,
        actorId: req.user.id,
        type: parentId ? 'community_reply' : 'community_comment',
        title: parentId ? `${actorName} respondio tu comentario` : `${actorName} comento tu publicacion`,
        body: texto,
        targetUrl,
        entityType: 'community_comment',
        entityId: result.rows[0].id,
        uniqueKey: `community-comment:${result.rows[0].id}:${receptorId}`,
      });
      await notificarMenciones({
        texto,
        actorId: req.user.id,
        actorName,
        targetUrl,
        entityType: 'community_comment',
        entityId: result.rows[0].id,
      });

      res.status(201).json(mapearComentario({
        ...result.rows[0],
        username: usuarioResult.rows[0]?.username,
        email: usuarioResult.rows[0]?.email || req.user.email,
        liked: false,
      }));
    } catch (error) {
      console.error('Error al comentar publicacion de comunidad:', error);
      res.status(500).json({ error: 'No se pudo guardar el comentario.' });
    }
  },

  alternarLikePublicacion: async (req, res) => {
    const { publicacionId } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await client.query('BEGIN');

      const publicacion = await client.query(
        'SELECT id, user_id, titulo, comunidad_id FROM comunidad_publicaciones WHERE id = $1',
        [publicacionId]
      );
      if (publicacion.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM comunidad_publicacion_likes WHERE user_id = $1 AND publicacion_id = $2',
        [req.user.id, publicacionId]
      );

      let liked = false;
      if (existe.rowCount > 0) {
        await client.query(
          'DELETE FROM comunidad_publicacion_likes WHERE user_id = $1 AND publicacion_id = $2',
          [req.user.id, publicacionId]
        );
      } else {
        await client.query(
          'INSERT INTO comunidad_publicacion_likes (user_id, publicacion_id) VALUES ($1, $2)',
          [req.user.id, publicacionId]
        );
        liked = true;
        await crearNotificacion({
          userId: publicacion.rows[0].user_id,
          actorId: req.user.id,
          type: 'community_like',
          title: `${nombreActor(req.user)} indico que le gusta tu publicacion`,
          body: publicacion.rows[0].titulo || '',
          targetUrl: `/comunidad?comunidad=${publicacion.rows[0].comunidad_id}&publicacion=${publicacionId}`,
          entityType: 'community_post',
          entityId: publicacionId,
          uniqueKey: `community-like:${req.user.id}:${publicacionId}`,
        }, client);
      }

      if (!liked) {
        await eliminarNotificacion(`community-like:${req.user.id}:${publicacionId}`, client);
      }

      const counts = await client.query(
        'SELECT COUNT(*)::int AS likes FROM comunidad_publicacion_likes WHERE publicacion_id = $1',
        [publicacionId]
      );
      await client.query('COMMIT');

      res.json({
        id: Number(publicacionId),
        liked,
        likes: Number(counts.rows[0]?.likes || 0),
        votos: Number(counts.rows[0]?.likes || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar like de publicacion:', error);
      res.status(500).json({ error: 'No se pudo actualizar el me gusta.' });
    } finally {
      client.release();
    }
  },

  alternarGuardadoPublicacion: async (req, res) => {
    const { publicacionId } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await client.query('BEGIN');

      const publicacion = await client.query('SELECT id FROM comunidad_publicaciones WHERE id = $1', [publicacionId]);
      if (publicacion.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM comunidad_publicacion_guardados WHERE user_id = $1 AND publicacion_id = $2',
        [req.user.id, publicacionId]
      );

      let guardado = false;
      if (existe.rowCount > 0) {
        await client.query(
          'DELETE FROM comunidad_publicacion_guardados WHERE user_id = $1 AND publicacion_id = $2',
          [req.user.id, publicacionId]
        );
      } else {
        await client.query(
          'INSERT INTO comunidad_publicacion_guardados (user_id, publicacion_id) VALUES ($1, $2)',
          [req.user.id, publicacionId]
        );
        guardado = true;
      }

      const counts = await client.query(
        'SELECT COUNT(*)::int AS guardados FROM comunidad_publicacion_guardados WHERE publicacion_id = $1',
        [publicacionId]
      );
      await client.query('COMMIT');

      res.json({
        id: Number(publicacionId),
        guardado,
        guardados: Number(counts.rows[0]?.guardados || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar guardado de publicacion:', error);
      res.status(500).json({ error: 'No se pudo actualizar el guardado.' });
    } finally {
      client.release();
    }
  },

  alternarLikeComentario: async (req, res) => {
    const { comentarioId } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await client.query('BEGIN');

      const comentario = await client.query(
        `SELECT cc.id, cc.user_id, cc.texto, cc.publicacion_id, cp.comunidad_id
         FROM comunidad_comentarios cc
         JOIN comunidad_publicaciones cp ON cp.id = cc.publicacion_id
         WHERE cc.id = $1`,
        [comentarioId]
      );
      if (comentario.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Comentario no encontrado.' });
      }

      const existe = await client.query(
        'SELECT 1 FROM comunidad_comentario_likes WHERE user_id = $1 AND comentario_id = $2',
        [req.user.id, comentarioId]
      );

      let liked = false;
      if (existe.rowCount > 0) {
        await client.query(
          'DELETE FROM comunidad_comentario_likes WHERE user_id = $1 AND comentario_id = $2',
          [req.user.id, comentarioId]
        );
      } else {
        await client.query(
          'INSERT INTO comunidad_comentario_likes (user_id, comentario_id) VALUES ($1, $2)',
          [req.user.id, comentarioId]
        );
        liked = true;
        await crearNotificacion({
          userId: comentario.rows[0].user_id,
          actorId: req.user.id,
          type: 'community_comment_like',
          title: `${nombreActor(req.user)} indico que le gusta tu comentario`,
          body: comentario.rows[0].texto || '',
          targetUrl: `/comunidad?comunidad=${comentario.rows[0].comunidad_id}&publicacion=${comentario.rows[0].publicacion_id}`,
          entityType: 'community_comment',
          entityId: comentarioId,
          uniqueKey: `community-comment-like:${req.user.id}:${comentarioId}`,
        }, client);
      }

      if (!liked) {
        await eliminarNotificacion(`community-comment-like:${req.user.id}:${comentarioId}`, client);
      }

      const counts = await client.query(
        'SELECT COUNT(*)::int AS likes FROM comunidad_comentario_likes WHERE comentario_id = $1',
        [comentarioId]
      );
      await client.query('COMMIT');

      res.json({
        id: Number(comentarioId),
        liked,
        likes: Number(counts.rows[0]?.likes || 0),
        votos: Number(counts.rows[0]?.likes || 0),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al alternar like de comentario de comunidad:', error);
      res.status(500).json({ error: 'No se pudo actualizar el me gusta.' });
    } finally {
      client.release();
    }
  },
};

module.exports = comunidadController;
