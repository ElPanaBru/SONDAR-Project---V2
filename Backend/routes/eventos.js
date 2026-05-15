const express = require('express');
const pool = require('../Pool_DB');

const router = express.Router();

const mapEvent = (row) => ({
  id: row.id,
  titulo: row.title,
  lugar: row.place,
  fecha: row.event_date
    ? new Date(row.event_date).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
  genero: row.genre,
  coords: [row.lat, row.lng],
  img: row.image,
  link: row.ticket_link || '',
  creador: row.creator_email || 'Anonimo',
  guardado: Boolean(row.guardado),
});

router.get('/', async (req, res) => {
  const { uid } = req.query;

  try {
    const result = await pool.query(
      `SELECT e.*, u.email AS creator_email,
              CASE WHEN s.id IS NULL THEN false ELSE true END AS guardado
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       LEFT JOIN saved_items s ON s.item_type = 'evento'
        AND s.item_id = e.id::text
        AND s.user_id = $1
       ORDER BY e.created_at DESC`,
      [uid || null]
    );

    res.json(result.rows.map(mapEvent));
  } catch (error) {
    console.error('Error obteniendo eventos:', error);
    res.status(500).json({ error: 'No se pudieron obtener los eventos.' });
  }
});

router.post('/', async (req, res) => {
  const {
    titulo,
    lugar,
    fecha,
    genero,
    coords,
    img,
    link,
    createdBy,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO events (title, place, event_date, genre, lat, lng, image, ticket_link, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        titulo,
        lugar,
        fecha ? new Date(fecha) : null,
        genero || 'otros',
        coords?.[0] ?? null,
        coords?.[1] ?? null,
        img || '',
        link || '',
        createdBy || null,
      ]
    );

    res.status(201).json(mapEvent({ ...result.rows[0], creator_email: req.body.creador, guardado: false }));
  } catch (error) {
    console.error('Error creando evento:', error);
    res.status(500).json({ error: 'No se pudo crear el evento.' });
  }
});

module.exports = router;
