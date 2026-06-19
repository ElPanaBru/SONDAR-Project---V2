const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const { subirImagenEvento, eliminarImagenEvento } = require('../services/storageService');

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
          COALESCE(u.username, u.full_name, u.artist_name, 'Anonimo') AS creador
        FROM eventos e
        LEFT JOIN users u ON u.id = e.creador_id
        ORDER BY e.id DESC
      `);

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
    const { titulo, genero, ubicacion, fecha, precio, link, latitud, longitud } = req.body;
    const creadorId = req.user.id;
    let imagenSubida = null;

    const creadorNombre =
      req.user?.user_metadata?.name ||
      req.user?.user_metadata?.username ||
      req.user?.email?.split('@')[0] ||
      'Anonimo';


    if (!titulo || !genero || !ubicacion || !fecha || !latitud || !longitud) {
      return res.status(400).json({ error: 'Faltan datos obligatorios del evento.' });
    }

    const precioNormalizado = precio === '' || precio === undefined ? null : Number(precio);

    if (precioNormalizado !== null && (!Number.isFinite(precioNormalizado) || precioNormalizado < 0)) {
      return res.status(400).json({ error: 'El precio de entrada no es valido.' });
    }

    try {
      await asegurarUsuarioPublico(req.user);
      imagenSubida = await subirImagenEvento(req.file);

      const query = `
        INSERT INTO eventos (titulo, genero, lugar, fecha, img_url, precio, link, creador_id, latitud, longitud)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`;

      const values = [
        titulo,
        genero,
        ubicacion,
        fecha,
        imagenSubida?.publicUrl || null,
        precioNormalizado,
        link || null,
        creadorId,
        latitud,
        longitud
      ];

      const result = await pool.query(query, values);
      res.status(201).json(mapearEvento({
        ...result.rows[0],
        creador: creadorNombre
      }));
    } catch (error) {
      if (imagenSubida?.path) {
        await eliminarImagenEvento(imagenSubida.path);
      }

      console.error('Error al crear evento:', error);
      res.status(500).json({ error: error.message || 'Error al guardar el evento.' });
    }
  },

  eliminarEvento: async (req, res) => {
    const { id } = req.params;
    const creadorId = req.user.id;

    try {
      const result = await pool.query(
        'DELETE FROM eventos WHERE id = $1 AND creador_id = $2 RETURNING id',
        [id, creadorId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Evento no encontrado o sin permiso para eliminarlo.' });
      }

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

      const evento = await pool.query('SELECT id FROM eventos WHERE id = $1', [id]);
      if (evento.rowCount === 0) {
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
