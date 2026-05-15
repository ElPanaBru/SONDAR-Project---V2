const express = require('express');
const pool = require('../Pool_DB');

const router = express.Router();

const mapThread = (thread, comments = []) => ({
  id: thread.id,
  comunidadId: thread.community_id,
  op: thread.op || 'Usuario Sondar',
  usuario: thread.username || '@seguidor',
  tipo: thread.type,
  titulo: thread.title,
  texto: thread.body,
  etiqueta: thread.tag || '',
  votos: thread.votes,
  guardado: Boolean(thread.guardado),
  comentarios: comments.map((comment) => ({
    id: comment.id,
    autor: comment.author || 'Usuario Sondar',
    usuario: comment.username || '@seguidor',
    texto: comment.body,
    votos: comment.votes,
  })),
});

router.get('/muro', (_req, res) => {
  res.json([
    { id: 1, usuario: 'Sondar_Admin', texto: 'La arquitectura esta lista.' },
    { id: 2, usuario: 'Sondar_Team', texto: 'Probando comunidad con PostgreSQL.' },
  ]);
});

router.get('/hilos', async (req, res) => {
  const { uid } = req.query;

  try {
    const threadsResult = await pool.query(
      `SELECT t.*,
              CASE WHEN s.id IS NULL THEN false ELSE true END AS guardado
       FROM community_threads t
       LEFT JOIN saved_items s ON s.item_type = 'hilo'
        AND s.item_id = t.id::text
        AND s.user_id = $1
       ORDER BY t.created_at DESC`,
      [uid || null]
    );

    if (!threadsResult.rows.length) {
      return res.json([]);
    }

    const commentsResult = await pool.query(
      'SELECT * FROM community_comments WHERE thread_id = ANY($1::int[]) ORDER BY created_at ASC',
      [threadsResult.rows.map((thread) => thread.id)]
    );

    const commentsByThread = commentsResult.rows.reduce((acc, comment) => {
      acc[comment.thread_id] = acc[comment.thread_id] || [];
      acc[comment.thread_id].push(comment);
      return acc;
    }, {});

    res.json(threadsResult.rows.map((thread) => mapThread(thread, commentsByThread[thread.id] || [])));
  } catch (error) {
    console.error('Error obteniendo hilos:', error);
    res.status(500).json({ error: 'No se pudieron obtener los hilos.' });
  }
});

router.post('/hilos', async (req, res) => {
  const {
    comunidadId,
    userId,
    op,
    usuario,
    tipo,
    titulo,
    texto,
    etiqueta,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO community_threads (community_id, user_id, op, username, type, title, body, tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [comunidadId, userId || null, op, usuario, tipo || 'destacado', titulo, texto, etiqueta || '']
    );

    res.status(201).json(mapThread(result.rows[0]));
  } catch (error) {
    console.error('Error creando hilo:', error);
    res.status(500).json({ error: 'No se pudo crear el hilo.' });
  }
});

router.post('/hilos/:id/respuestas', async (req, res) => {
  const { id } = req.params;
  const { userId, autor, usuario, texto } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO community_comments (thread_id, user_id, author, username, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, userId || null, autor, usuario, texto]
    );

    res.status(201).json({
      id: result.rows[0].id,
      autor: result.rows[0].author,
      usuario: result.rows[0].username,
      texto: result.rows[0].body,
      votos: result.rows[0].votes,
    });
  } catch (error) {
    console.error('Error creando respuesta:', error);
    res.status(500).json({ error: 'No se pudo crear la respuesta.' });
  }
});

router.post('/hilos/:id/votar', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE community_threads SET votes = votes + 1 WHERE id = $1 RETURNING votes',
      [id]
    );
    res.json({ votos: result.rows[0]?.votes || 0 });
  } catch (error) {
    console.error('Error votando hilo:', error);
    res.status(500).json({ error: 'No se pudo registrar el voto.' });
  }
});

module.exports = router;
