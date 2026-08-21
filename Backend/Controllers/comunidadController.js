const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const supabaseAuth = supabase.authClient || supabase;
const {
  crearNotificacion,
  eliminarNotificacion,
  nombreActor,
  notificarMiembrosComunidad,
  notificarMenciones,
} = require('../services/notificationService');
const { asegurarEsquemaModeracion, registrarDenuncia } = require('../services/moderationService');

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
  {
    id: 'alternativo',
    nombre: '@alternativo',
    titulo: 'Alternativo',
    genero: 'alternativo',
    descripcion: 'Propuestas independientes, cruces de estilos, nuevos sonidos y conversaciones de la escena alternativa.',
    portada: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'punk',
    nombre: '@punk',
    titulo: 'Punk',
    genero: 'punk',
    descripcion: 'Bandas, fechas, discos, autogestion y debates de la comunidad punk de SONDAR.',
    portada: 'https://images.unsplash.com/photo-1508252592163-5d3c3c5599ab?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'reggae',
    nombre: '@reggae',
    titulo: 'Reggae',
    genero: 'reggae',
    descripcion: 'Riddims, bandas, dub, cultura soundsystem, lanzamientos y encuentros de la escena reggae.',
    portada: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80',
  },
  {
    id: 'latina',
    nombre: '@latina',
    titulo: 'Latina',
    genero: 'latina',
    descripcion: 'Salsa, bachata, merengue, sonidos urbanos y novedades de la musica latina.',
    portada: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80',
  },
];

const DIAS_RELEVANCIA_COMUNIDAD = Math.max(
  1,
  Number.parseInt(process.env.COMMUNITY_RELEVANT_DAYS || '7', 10) || 7
);
const UMBRAL_LIKES_RELEVANCIA_COMUNIDAD = Math.max(
  1,
  Number.parseInt(process.env.COMMUNITY_RELEVANT_LIKES || '5', 10) || 5
);

let esquemaComunidadesListo = null;

async function obtenerViewerId(req) {
  if (req.user?.id) return req.user.id;

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  if (!token) return null;

  const { data, error } = await supabaseAuth.auth.getUser(token);
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
    [user.id, email, usernameSeguro, process.env.DEFAULT_USER_TYPE || 'musico']
  );
}

async function asegurarEsquemaComunidades() {
  if (!esquemaComunidadesListo) {
    esquemaComunidadesListo = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidades (
          id text PRIMARY KEY,
          nombre text NOT NULL UNIQUE,
          titulo text NOT NULL,
          genero text NOT NULL UNIQUE,
          descripcion text NOT NULL,
          portada_url text,
          activa boolean NOT NULL DEFAULT true,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidad_publicaciones (
          id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          comunidad_id text NOT NULL REFERENCES comunidades(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tipo text NOT NULL DEFAULT 'reciente'
            CHECK (tipo IN ('destacado', 'reciente', 'popular', 'preguntas')),
          titulo text NOT NULL CHECK (length(trim(titulo)) > 0),
          texto text NOT NULL CHECK (length(trim(texto)) > 0),
          etiqueta text,
          evento_asociado_id text,
          reel_asociado_id text,
          fijada boolean NOT NULL DEFAULT false,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidad_miembros (
          comunidad_id text NOT NULL REFERENCES comunidades(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          nivel_notificaciones text NOT NULL DEFAULT 'todas'
            CHECK (nivel_notificaciones IN ('todas', 'relevantes', 'silenciadas')),
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          CONSTRAINT comunidad_miembros_pkey PRIMARY KEY (comunidad_id, user_id)
        )
      `);

      await pool.query("ALTER TABLE comunidad_miembros ADD COLUMN IF NOT EXISTS nivel_notificaciones text NOT NULL DEFAULT 'todas'");
      await pool.query('ALTER TABLE comunidad_publicaciones ADD COLUMN IF NOT EXISTS evento_asociado_id text');
      await pool.query('ALTER TABLE comunidad_publicaciones ADD COLUMN IF NOT EXISTS reel_asociado_id text');

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidad_publicacion_likes (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          publicacion_id bigint NOT NULL REFERENCES comunidad_publicaciones(id) ON DELETE CASCADE,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          CONSTRAINT comunidad_publicacion_likes_pkey PRIMARY KEY (user_id, publicacion_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidad_publicacion_guardados (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          publicacion_id bigint NOT NULL REFERENCES comunidad_publicaciones(id) ON DELETE CASCADE,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          CONSTRAINT comunidad_publicacion_guardados_pkey PRIMARY KEY (user_id, publicacion_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidad_comentarios (
          id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          publicacion_id bigint NOT NULL REFERENCES comunidad_publicaciones(id) ON DELETE CASCADE,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          parent_id bigint REFERENCES comunidad_comentarios(id) ON DELETE CASCADE,
          texto text NOT NULL CHECK (length(trim(texto)) > 0),
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comunidad_comentario_likes (
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          comentario_id bigint NOT NULL REFERENCES comunidad_comentarios(id) ON DELETE CASCADE,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          CONSTRAINT comunidad_comentario_likes_pkey PRIMARY KEY (user_id, comentario_id)
        )
      `);

      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_publicaciones_comunidad ON comunidad_publicaciones(comunidad_id, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_publicaciones_user ON comunidad_publicaciones(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_miembros_user ON comunidad_miembros(user_id, created_at DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_publicacion_likes_publicacion ON comunidad_publicacion_likes(publicacion_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_publicacion_guardados_publicacion ON comunidad_publicacion_guardados(publicacion_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_comentarios_publicacion ON comunidad_comentarios(publicacion_id, created_at ASC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_comentarios_parent ON comunidad_comentarios(parent_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_comunidad_comentario_likes_comentario ON comunidad_comentario_likes(comentario_id)');
      await pool.query('ALTER TABLE comunidad_miembros ENABLE ROW LEVEL SECURITY');
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'comunidad_miembros'
              AND policyname = 'comunidad_miembros_select_own'
          ) THEN
            CREATE POLICY comunidad_miembros_select_own ON comunidad_miembros
              FOR SELECT TO authenticated USING (auth.uid() = user_id);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'comunidad_miembros'
              AND policyname = 'comunidad_miembros_own_write'
          ) THEN
            CREATE POLICY comunidad_miembros_own_write ON comunidad_miembros
              FOR ALL TO authenticated
              USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);
          END IF;
        END $$
      `);

      for (const comunidad of COMUNIDADES_GENERO) {
        await pool.query(
          `INSERT INTO comunidades (id, nombre, titulo, genero, descripcion, portada_url)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE
           SET nombre = EXCLUDED.nombre,
               titulo = EXCLUDED.titulo,
               genero = EXCLUDED.genero,
               descripcion = EXCLUDED.descripcion,
               portada_url = EXCLUDED.portada_url,
               activa = true`,
          [
            comunidad.id,
            comunidad.nombre,
            comunidad.titulo,
            comunidad.genero,
            comunidad.descripcion,
            comunidad.portada,
          ]
        );
      }

      await pool.query(`
        UPDATE comunidades
        SET activa = false
        WHERE lower(id) = 'otros' OR lower(genero) = 'otros'
      `);
    })().catch((error) => {
      esquemaComunidadesListo = null;
      throw error;
    });
  }

  return esquemaComunidadesListo;
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
    nivelNotificaciones: row.unido ? (row.nivel_notificaciones || 'todas') : null,
    criterioRelevancia: {
      likes: UMBRAL_LIKES_RELEVANCIA_COMUNIDAD,
      dias: DIAS_RELEVANCIA_COMUNIDAD,
    },
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
    votos: Number(row.likes_calculados ?? row.likes ?? 0),
    likes: Number(row.likes_calculados ?? row.likes ?? 0),
    liked: Boolean(row.liked),
    guardado: Boolean(row.guardado),
    comentarios,
    comentariosTotal: Number(row.comentarios_total || comentarios.length),
    tiempo: tiempoRelativo(row.created_at),
  };
}

async function listarComentariosPublicaciones(publicacionIds, viewerId) {
  if (publicacionIds.length === 0) return new Map();

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
     WHERE cc.publicacion_id = ANY($1::bigint[])
     ORDER BY cc.created_at ASC, cc.id ASC`,
    [publicacionIds, viewerId]
  );

  const porPublicacion = new Map();
  publicacionIds.forEach((id) => porPublicacion.set(String(id), []));

  result.rows.forEach((row) => {
    const key = String(row.publicacion_id);
    porPublicacion.set(key, [...(porPublicacion.get(key) || []), row]);
  });

  const anidados = new Map();
  porPublicacion.forEach((rows, key) => {
    anidados.set(key, anidarComentarios(rows));
  });

  return anidados;
}

const comunidadController = {
  listarComunidades: async (req, res) => {
    try {
      await asegurarEsquemaComunidades();
      const viewerId = await obtenerViewerId(req);

      const result = await pool.query(`
        SELECT
          c.*,
          COUNT(DISTINCT cp.id) AS publicaciones,
          COUNT(DISTINCT cm.user_id) AS miembros,
          EXISTS (
            SELECT 1
            FROM comunidad_miembros cm_viewer
            WHERE cm_viewer.comunidad_id = c.id
              AND cm_viewer.user_id = $2::uuid
          ) AS unido,
          (
            SELECT cm_viewer.nivel_notificaciones
            FROM comunidad_miembros cm_viewer
            WHERE cm_viewer.comunidad_id = c.id
              AND cm_viewer.user_id = $2::uuid
          ) AS nivel_notificaciones
        FROM comunidades c
        LEFT JOIN comunidad_publicaciones cp ON cp.comunidad_id = c.id
        LEFT JOIN comunidad_miembros cm ON cm.comunidad_id = c.id
        WHERE c.activa = true
          AND c.id = ANY($1::text[])
        GROUP BY c.id
        ORDER BY array_position($1::text[], c.id)
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
        nivelNotificaciones: unido ? 'todas' : null,
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al actualizar membresia del foro:', error);
      res.status(500).json({ error: 'No se pudo actualizar tu membresia del foro.' });
    } finally {
      client.release();
    }
  },

  actualizarNotificaciones: async (req, res) => {
    const { comunidadId } = req.params;
    const nivel = String(req.body?.nivel || '').toLowerCase();
    const nivelesPermitidos = ['todas', 'relevantes', 'silenciadas'];

    if (!nivelesPermitidos.includes(nivel)) {
      return res.status(400).json({ error: 'Selecciona un nivel de notificaciones valido.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      const membresia = await pool.query(
        `UPDATE comunidad_miembros
         SET nivel_notificaciones = $3
         WHERE comunidad_id = $1 AND user_id = $2
         RETURNING comunidad_id, nivel_notificaciones`,
        [comunidadId, req.user.id, nivel]
      );

      if (membresia.rowCount === 0) {
        return res.status(403).json({ error: 'Unite a esta comunidad para configurar sus notificaciones.' });
      }

      return res.json({
        comunidadId: membresia.rows[0].comunidad_id,
        nivelNotificaciones: membresia.rows[0].nivel_notificaciones,
      });
    } catch (error) {
      console.error('Error al actualizar notificaciones de la comunidad:', error);
      return res.status(500).json({ error: 'No se pudieron actualizar las notificaciones de la comunidad.' });
    }
  },

  listarPublicaciones: async (req, res) => {
    const { comunidadId } = req.params;
    const filtroRecibido = req.query.filtro || 'destacado';
    const filtro = ['destacado', 'reciente', 'popular', 'preguntas'].includes(filtroRecibido)
      ? filtroRecibido
      : 'destacado';
    const busqueda = `${req.query.q || ''}`.trim().toLowerCase();

    try {
      await asegurarEsquemaComunidades();
      const viewerId = await obtenerViewerId(req);
      const params = [comunidadId, viewerId];
      const condiciones = ['cp.comunidad_id = $1'];

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

      const result = await pool.query(
        `SELECT
           cp.*,
           c.genero,
           u.username,
           u.email,
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
         WHERE ${condiciones.join(' AND ')}
         ORDER BY ${orderBy}`,
        params
      );

      const ids = result.rows.map((row) => row.id);
      const comentariosPorPublicacion = await listarComentariosPublicaciones(ids, viewerId);

      res.json(result.rows.map((row) => mapearPublicacion(
        row,
        comentariosPorPublicacion.get(String(row.id)) || []
      )));
    } catch (error) {
      console.error('Error al listar publicaciones de comunidad:', error);
      res.status(500).json({ error: 'No se pudieron cargar las publicaciones.' });
    }
  },

  crearPublicacion: async (req, res) => {
    const { comunidadId } = req.params;
    const titulo = req.body.titulo?.trim();
    const texto = req.body.texto?.trim();
    const tipo = req.body.tipo || 'reciente';
    const etiqueta = req.body.etiqueta?.trim() || null;
    const eventoAsociadoId = req.body.eventoAsociadoId ? String(req.body.eventoAsociadoId).trim() : null;
    const reelAsociadoId = req.body.reelAsociadoId ? String(req.body.reelAsociadoId).trim() : null;

    if (!titulo || !texto) {
      return res.status(400).json({ error: 'Completa titulo y texto para publicar.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();

      const comunidad = await pool.query('SELECT id, genero, titulo FROM comunidades WHERE id = $1 AND activa = true', [comunidadId]);
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

      const tipoSeguro = ['destacado', 'reciente', 'popular', 'preguntas'].includes(tipo) ? tipo : 'reciente';
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
          reelAsociadoId || null,
        ]
      );

      const usuarioResult = await pool.query(
        `SELECT u.username, u.email
         FROM users u
         WHERE u.id = $1`,
        [req.user.id]
      );

      const actorName = nombreActor(req.user);
      const targetUrl = `/comunidad?comunidad=${comunidadId}&publicacion=${result.rows[0].id}`;
      const notificationTitle = `Nueva publicacion en ${comunidad.rows[0].titulo || comunidadId}`;
      const uniquePrefix = `new-community-post:${result.rows[0].id}`;
      await notificarMiembrosComunidad({
        comunidadId,
        actorId: req.user.id,
        type: 'new_community_post',
        title: notificationTitle,
        body: `${actorName}: ${titulo}`,
        targetUrl,
        uniquePrefix,
      });
      await notificarMenciones({
        texto,
        actorId: req.user.id,
        actorName,
        targetUrl,
        entityType: 'community_post',
        entityId: result.rows[0].id,
        communityId: comunidadId,
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

  eliminarPublicacion: async (req, res) => {
    const { publicacionId } = req.params;
    const client = await pool.connect();

    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await client.query('BEGIN');

      const publicacion = await client.query(
        `SELECT id, comunidad_id, user_id
         FROM comunidad_publicaciones
         WHERE id = $1`,
        [publicacionId]
      );

      if (publicacion.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }

      if (String(publicacion.rows[0].user_id) !== String(req.user.id)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Solo podes eliminar tus propias publicaciones.' });
      }

      const targetBase = `/comunidad?comunidad=${publicacion.rows[0].comunidad_id}&publicacion=${publicacionId}`;
      await client.query(
        `DELETE FROM notifications
         WHERE target_url = $1
            OR target_url LIKE $2
            OR unique_key LIKE $3
            OR unique_key LIKE $4
            OR unique_key LIKE $5`,
        [
          targetBase,
          `${targetBase}&%`,
          `new-community-post:${publicacionId}:%`,
          `community-like:%:${publicacionId}`,
          `mention:community_post:${publicacionId}:%`,
        ]
      );

      await client.query('DELETE FROM comunidad_publicaciones WHERE id = $1', [publicacionId]);
      await client.query('COMMIT');

      return res.status(204).send();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al eliminar publicacion de comunidad:', error);
      return res.status(500).json({ error: 'No se pudo eliminar la publicacion.' });
    } finally {
      client.release();
    }
  },

  crearComentario: async (req, res) => {
    const { publicacionId } = req.params;
    const texto = req.body.texto?.trim();
    const parentId = req.body.parentId || null;

    if (!texto) {
      return res.status(400).json({ error: 'El comentario no puede estar vacio.' });
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
        return res.status(400).json({ error: 'El comentario respondido no pertenece a esta publicacion.' });
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
      const targetUrl = `/comunidad?comunidad=${publicacion.rows[0].comunidad_id}&publicacion=${publicacionId}&comentario=${result.rows[0].id}`;
      await crearNotificacion({
        userId: receptorId,
        actorId: req.user.id,
        type: parentId ? 'community_reply' : 'community_comment',
        title: parentId ? `${actorName} respondio tu comentario` : `${actorName} comento tu publicacion`,
        body: texto,
        targetUrl,
        entityType: 'community_comment',
        entityId: result.rows[0].id,
        communityId: publicacion.rows[0].comunidad_id,
        uniqueKey: `community-comment:${result.rows[0].id}:${receptorId}`,
      });
      await notificarMenciones({
        texto,
        actorId: req.user.id,
        actorName,
        targetUrl,
        entityType: 'community_comment',
        entityId: result.rows[0].id,
        communityId: publicacion.rows[0].comunidad_id,
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
        `SELECT cp.id, cp.user_id, cp.titulo, cp.comunidad_id,
                c.titulo AS comunidad_titulo
         FROM comunidad_publicaciones cp
         JOIN comunidades c ON c.id = cp.comunidad_id
         WHERE cp.id = $1`,
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
          communityId: publicacion.rows[0].comunidad_id,
          uniqueKey: `community-like:${req.user.id}:${publicacionId}`,
        }, client);
      }

      if (!liked) {
        await eliminarNotificacion(`community-like:${req.user.id}:${publicacionId}`, client);
      }

      const counts = await client.query(
        `SELECT
           COUNT(*)::int AS likes,
           COUNT(*) FILTER (
             WHERE created_at >= now() - ($2::int * interval '1 day')
           )::int AS likes_semana
         FROM comunidad_publicacion_likes
         WHERE publicacion_id = $1`,
        [publicacionId, DIAS_RELEVANCIA_COMUNIDAD]
      );
      const totalLikes = Number(counts.rows[0]?.likes || 0);
      const likesRecientes = Number(counts.rows[0]?.likes_semana || 0);

      if (
        liked
        && likesRecientes >= UMBRAL_LIKES_RELEVANCIA_COMUNIDAD
      ) {
        await notificarMiembrosComunidad({
          comunidadId: publicacion.rows[0].comunidad_id,
          actorId: publicacion.rows[0].user_id,
          type: 'new_community_post',
          title: `Publicacion relevante en ${publicacion.rows[0].comunidad_titulo}`,
          body: `${publicacion.rows[0].titulo} recibio ${likesRecientes} likes en los ultimos ${DIAS_RELEVANCIA_COMUNIDAD} dias.`,
          targetUrl: `/comunidad?comunidad=${publicacion.rows[0].comunidad_id}&publicacion=${publicacionId}`,
          uniquePrefix: `new-community-post:${publicacionId}`,
          nivel: 'relevantes',
        }, client);
      }
      await client.query('COMMIT');

      res.json({
        id: Number(publicacionId),
        liked,
        likes: totalLikes,
        votos: totalLikes,
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
          targetUrl: `/comunidad?comunidad=${comentario.rows[0].comunidad_id}&publicacion=${comentario.rows[0].publicacion_id}&comentario=${comentarioId}`,
          entityType: 'community_comment',
          entityId: comentarioId,
          communityId: comentario.rows[0].comunidad_id,
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

  denunciarPublicacion: async (req, res) => {
    const { publicacionId } = req.params;
    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await asegurarEsquemaModeracion();
      const publicacion = await pool.query(
        `SELECT id, user_id, titulo, comunidad_id
         FROM comunidad_publicaciones
         WHERE id = $1`,
        [publicacionId]
      );
      if (publicacion.rowCount === 0) {
        return res.status(404).json({ error: 'Publicacion no encontrada.' });
      }

      const resultado = await registrarDenuncia({
        reporterId: req.user.id,
        reportedUserId: publicacion.rows[0].user_id,
        contentType: 'community_post',
        contentId: publicacionId,
        reason: req.body?.reason,
        details: req.body?.detail,
      });
      return res.json({
        ...resultado,
        comunidadId: publicacion.rows[0].comunidad_id,
        titulo: publicacion.rows[0].titulo,
      });
    } catch (error) {
      console.error('Error al denunciar publicacion de comunidad:', error);
      return res.status(error.status || 500).json({ error: error.message || 'No se pudo denunciar la publicacion.' });
    }
  },

  denunciarComentario: async (req, res) => {
    const { comentarioId } = req.params;
    try {
      await asegurarUsuarioPublico(req.user);
      await asegurarEsquemaComunidades();
      await asegurarEsquemaModeracion();
      const comentario = await pool.query(
        `SELECT cc.id, cc.user_id, cc.texto, cc.publicacion_id, cp.comunidad_id
         FROM comunidad_comentarios cc
         JOIN comunidad_publicaciones cp ON cp.id = cc.publicacion_id
         WHERE cc.id = $1`,
        [comentarioId]
      );
      if (comentario.rowCount === 0) {
        return res.status(404).json({ error: 'Comentario no encontrado.' });
      }

      const resultado = await registrarDenuncia({
        reporterId: req.user.id,
        reportedUserId: comentario.rows[0].user_id,
        contentType: 'community_comment',
        contentId: comentarioId,
        reason: req.body?.reason,
        details: req.body?.detail,
      });
      return res.json({
        ...resultado,
        comunidadId: comentario.rows[0].comunidad_id,
        publicacionId: Number(comentario.rows[0].publicacion_id),
      });
    } catch (error) {
      console.error('Error al denunciar comentario de comunidad:', error);
      return res.status(error.status || 500).json({ error: error.message || 'No se pudo denunciar el comentario.' });
    }
  },
};

module.exports = comunidadController;
