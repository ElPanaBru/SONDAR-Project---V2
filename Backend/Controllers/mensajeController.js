const pool = require('../Pool_DB');
const { asegurarEsquemaMensajes } = require('../services/messagesSchema');
const { asegurarEsquemaModeracion } = require('../services/moderationService');
const { crearNotificacion } = require('../services/notificationService');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONVERSATION_ID_PATTERN = /^\d+$/;

const conversacionSql = `
  SELECT
    c.id::text,
    c.updated_at,
    otro.id::text AS person_id,
    COALESCE(otro.artist_name, otro.full_name, otro.username, 'Usuario SONDAR') AS person_name,
    CASE WHEN otro.username IS NULL THEN '@usuario' ELSE '@' || ltrim(otro.username, '@') END AS person_handle,
    COALESCE(otro.profile_img_url, '') AS person_avatar,
    COALESCE(ultimo.body, '') AS last_message,
    ultimo.created_at AS last_message_at,
    COALESCE(no_leidos.total, 0)::int AS unread
  FROM conversations c
  JOIN conversation_members propio ON propio.conversation_id = c.id AND propio.user_id = $1
  JOIN conversation_members ajeno ON ajeno.conversation_id = c.id AND ajeno.user_id <> $1
  JOIN users otro ON otro.id = ajeno.user_id
  LEFT JOIN LATERAL (
    SELECT body, created_at
    FROM messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ) ultimo ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM messages
    WHERE conversation_id = c.id AND sender_id <> $1 AND read_at IS NULL
  ) no_leidos ON true
`;

function mapearConversacion(row) {
  return {
    id: String(row.id),
    person: {
      id: String(row.person_id),
      nombre: row.person_name,
      usuario: row.person_handle,
      avatar: row.person_avatar || '',
    },
    lastMessage: row.last_message || '',
    updatedAt: row.last_message_at || row.updated_at,
    unread: Number(row.unread || 0),
  };
}

async function buscarConversacion(userId, conversationId, client = pool) {
  const result = await client.query(
    `${conversacionSql}
     WHERE c.id = $2
     LIMIT 1`,
    [userId, conversationId]
  );
  return result.rows[0] ? mapearConversacion(result.rows[0]) : null;
}

const mensajeController = {
  listarConversaciones: async (req, res) => {
    try {
      await asegurarEsquemaMensajes();
      const result = await pool.query(
        `${conversacionSql}
         ORDER BY COALESCE(ultimo.created_at, c.updated_at) DESC
         LIMIT 100`,
        [req.user.id]
      );
      res.json(result.rows.map(mapearConversacion));
    } catch (error) {
      console.error('Error al listar conversaciones:', error);
      res.status(500).json({ error: 'No se pudieron cargar las conversaciones.' });
    }
  },

  crearConversacion: async (req, res) => {
    const recipientId = String(req.body?.recipientId || '').trim();
    if (!recipientId) return res.status(400).json({ error: 'Falta el destinatario.' });
    if (!UUID_PATTERN.test(recipientId)) return res.status(400).json({ error: 'Destinatario inválido.' });
    if (recipientId === req.user.id) return res.status(400).json({ error: 'No podes enviarte mensajes a vos mismo.' });

    const client = await pool.connect();
    try {
      await Promise.all([asegurarEsquemaMensajes(), asegurarEsquemaModeracion()]);
      const [destinatario, bloqueo] = await Promise.all([
        pool.query('SELECT id FROM users WHERE id = $1', [recipientId]),
        pool.query(
          `SELECT 1 FROM user_blocks
           WHERE (blocker_id = $1 AND blocked_id = $2)
              OR (blocker_id = $2 AND blocked_id = $1)`,
          [req.user.id, recipientId]
        ),
      ]);
      if (destinatario.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
      if (bloqueo.rowCount > 0) return res.status(403).json({ error: 'No se puede iniciar esta conversación.' });

      const directKey = [req.user.id, recipientId].sort().join(':');
      await client.query('BEGIN');
      const creada = await client.query(
        `INSERT INTO conversations (direct_key)
         VALUES ($1)
         ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key
         RETURNING id`,
        [directKey]
      );
      const conversationId = creada.rows[0].id;
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT DO NOTHING`,
        [conversationId, req.user.id, recipientId]
      );
      await client.query('COMMIT');

      const conversation = await buscarConversacion(req.user.id, conversationId);
      res.status(201).json(conversation);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al crear conversación:', error);
      res.status(500).json({ error: 'No se pudo iniciar la conversación.' });
    } finally {
      client.release();
    }
  },

  obtenerConversacion: async (req, res) => {
    if (!CONVERSATION_ID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ error: 'Conversación inválida.' });
    }
    try {
      await asegurarEsquemaMensajes();
      const conversation = await buscarConversacion(req.user.id, req.params.id);
      if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada.' });

      await pool.query(
        `UPDATE messages
         SET read_at = COALESCE(read_at, timezone('utc'::text, now()))
         WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
        [req.params.id, req.user.id]
      );
      const result = await pool.query(
        `SELECT id::text, body AS text, created_at, sender_id = $2 AS mine
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC, id ASC
         LIMIT 500`,
        [req.params.id, req.user.id]
      );
      res.json({
        ...conversation,
        unread: 0,
        messages: result.rows.map((row) => ({
          id: row.id,
          text: row.text,
          createdAt: row.created_at,
          mine: row.mine,
        })),
      });
    } catch (error) {
      console.error('Error al obtener conversación:', error);
      res.status(500).json({ error: 'No se pudo cargar la conversación.' });
    }
  },

  enviarMensaje: async (req, res) => {
    if (!CONVERSATION_ID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ error: 'Conversación inválida.' });
    }
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Escribí un mensaje.' });
    if (text.length > 2000) return res.status(400).json({ error: 'El mensaje es demasiado largo.' });

    const client = await pool.connect();
    try {
      await Promise.all([asegurarEsquemaMensajes(), asegurarEsquemaModeracion()]);
      const miembro = await pool.query(
        `SELECT otro.user_id AS recipient_id,
                COALESCE(actor.artist_name, actor.full_name, actor.username, 'Alguien') AS actor_name
         FROM conversation_members propio
         JOIN conversation_members otro ON otro.conversation_id = propio.conversation_id AND otro.user_id <> $2
         JOIN users actor ON actor.id = $2
         WHERE propio.conversation_id = $1 AND propio.user_id = $2`,
        [req.params.id, req.user.id]
      );
      if (miembro.rowCount === 0) return res.status(404).json({ error: 'Conversación no encontrada.' });

      const recipientId = miembro.rows[0].recipient_id;
      const bloqueo = await pool.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [req.user.id, recipientId]
      );
      if (bloqueo.rowCount > 0) return res.status(403).json({ error: 'No se puede enviar este mensaje.' });

      await client.query('BEGIN');
      const insertado = await client.query(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES ($1, $2, $3)
         RETURNING id::text, body AS text, created_at`,
        [req.params.id, req.user.id, text]
      );
      await client.query(
        `UPDATE conversations
         SET updated_at = timezone('utc'::text, now())
         WHERE id = $1`,
        [req.params.id]
      );
      await client.query('COMMIT');

      const message = { ...insertado.rows[0], createdAt: insertado.rows[0].created_at, mine: true };
      delete message.created_at;
      await crearNotificacion({
        userId: recipientId,
        actorId: req.user.id,
        type: 'message',
        title: `${miembro.rows[0].actor_name} te envió un mensaje`,
        body: text.slice(0, 140),
        targetUrl: `/mensajes?conversation=${req.params.id}`,
        entityType: 'conversation',
        entityId: req.params.id,
        uniqueKey: `message:${insertado.rows[0].id}`,
      });
      res.status(201).json(message);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      console.error('Error al enviar mensaje:', error);
      res.status(500).json({ error: 'No se pudo enviar el mensaje.' });
    } finally {
      client.release();
    }
  },
};

module.exports = mensajeController;
