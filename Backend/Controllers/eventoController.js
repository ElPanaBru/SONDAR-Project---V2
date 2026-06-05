const pool = require('../Pool_DB');
const { subirImagenEvento, eliminarImagenEvento } = require('../services/storageService');

function mapearEvento(evento) {
  if (!evento) return evento;

  return {
    ...evento,
    img: evento.img_url || null,
    creador: evento.creador || null
  };
}

const eventoController = {
  listarEventos: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          e.*,
          e.img_url AS img,
          COALESCE(u.username, u.email, 'Anonimo') AS creador
        FROM eventos e
        LEFT JOIN users u ON u.id = e.creador_id
        ORDER BY e.id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error('Error al listar eventos:', error);
      res.status(500).json({ error: 'Error al obtener los eventos.' });
    }
  },

  crearEvento: async (req, res) => {
    const { titulo, genero, ubicacion, fecha, link, latitud, longitud } = req.body;
    const creadorId = req.user.id;
    let imagenSubida = null;

    if (!titulo || !genero || !ubicacion || !fecha || !latitud || !longitud) {
      return res.status(400).json({ error: 'Faltan datos obligatorios del evento.' });
    }

    try {
      imagenSubida = await subirImagenEvento(req.file);

      const query = `
        INSERT INTO eventos (titulo, genero, lugar, fecha, img_url, link, creador_id, latitud, longitud)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`;

      const values = [
        titulo,
        genero,
        ubicacion,
        fecha,
        imagenSubida?.publicUrl || null,
        link || null,
        creadorId,
        latitud,
        longitud
      ];

      const result = await pool.query(query, values);
      res.status(201).json(mapearEvento({
        ...result.rows[0],
        creador: req.user?.email || 'Anonimo'
      }));
    } catch (error) {
      if (imagenSubida?.path) {
        await eliminarImagenEvento(imagenSubida.path);
      }

      console.error('Error al crear evento:', error);
      res.status(500).json({ error: error.message || 'Error al guardar el evento.' });
    }
  }
};

module.exports = eventoController;
