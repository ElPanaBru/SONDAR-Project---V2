const pool = require('../Pool_DB');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 60;
const RATE_WINDOW_SECONDS = 10;
const RATE_MAX_MESSAGES = 8;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, parsed);
}

function normalizeMessage(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

function mapConversation(row) {
  return {
    id: row.id,
    usuario: {
      id: row.other_user_id,
      username: row.other_username,
      nombre: row.other_display_name || row.other_username,
      avatar: row.other_avatar || '',
    },
    ultimoMensaje: row.last_message_id ? {
      id: row.last_message_id,
      texto: row.last_message_deleted_at ? 'Mensaje eliminado' : row.last_message_body,
      propio: row.last_message_sender_id === row.viewer_id,
      creadoEn: row.last_message_created_at,
      eliminado: Boolean(row.last_message_deleted_at),
    } : null,
    noLeidos: Number(row.unread_count || 0),
    ultimaActividad: row.last_message_at,
    silenciada: Boolean(row.muted),
    bloqueada: Boolean(row.blocked),
  };
}

function mapMessage(row, viewerId) {
  const deleted = Boolean(row.deleted_at);
  return {
    id: row.id,
    conversacionId: row.conversation_id,
    texto: deleted ? 'Mensaje eliminado' : row.body,
    remitente: {
      id: row.sender_id,
      username: row.sender_username,
      nombre: row.sender_display_name || row.sender_username,
      avatar: row.sender_avatar || '',
    },
    propio: row.sender_id === viewerId,
    respuestaA: row.reply_to_id ? {
      id: row.reply_to_id,
      texto: row.reply_deleted_at ? 'Mensaje eliminado' : row.reply_body,
      remitenteId: row.reply_sender_id,
      eliminado: Boolean(row.reply_deleted_at),
    } : null,
    creadoEn: row.created_at,
    editadoEn: row.edited_at,
    eliminado: deleted,
    leido: row.sender_id === viewerId
      ? Boolean(row.other_last_read_at && new Date(row.other_last_read_at) >= new Date(row.created_at))
      : true,
  };
}

function schemaUnavailable(error) {
  return error?.code === '42P01' || error?.code === '42703' || error?.code === '42883';
}

function handleError(res, error, fallback) {
  if (schemaUnavailable(error)) {
    return res.status(503).json({
      error: 'La mensajeria aun no esta instalada. Ejecuta la migracion Sistema_Beta_Mensajeria_Ubicacion_Recomendaciones.sql.',
      code: 'MESSAGING_SCHEMA_MISSING',
    });
  }
  console.error(fallback, error);
  return res.status(error.status || 500).json({ error: error.message || fallback });
}

async function getConversation(conversationId, viewerId, client = pool) {
  const result = await client.query(
    `SELECT
       c.id,
       c.last_message_at,
       mine.user_id AS viewer_id,
       mine.muted,
       other.user_id AS other_user_id,
       u.username AS other_username,
       u.display_name AS other_display_name,
       u.profile_img_url AS other_avatar,
       last_message.id AS last_message_id,
       last_message.body AS last_message_body,
       last_message.sender_id AS last_message_sender_id,
       last_message.created_at AS last_message_created_at,
       last_message.deleted_at AS last_message_deleted_at,
       COALESCE(unread.total, 0)::int AS unread_count,
       EXISTS (
         SELECT 1 FROM public.user_blocks ub
         WHERE (ub.blocker_id = mine.user_id AND ub.blocked_id = other.user_id)
            OR (ub.blocker_id = other.user_id AND ub.blocked_id = mine.user_id)
       ) AS blocked
     FROM public.conversations c
     JOIN public.conversation_members mine
       ON mine.conversation_id = c.id AND mine.user_id = $2
     JOIN public.conversation_members other
       ON other.conversation_id = c.id AND other.user_id <> $2
     JOIN public.users u ON u.id = other.user_id
     LEFT JOIN LATERAL (
       SELECT m.* FROM public.messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.id DESC LIMIT 1
     ) last_message ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total
       FROM public.messages unread_message
       WHERE unread_message.conversation_id = c.id
         AND unread_message.sender_id <> $2
         AND unread_message.created_at > mine.last_read_at
         AND unread_message.deleted_at IS NULL
     ) unread ON true
     WHERE c.id = $1
     LIMIT 1`,
    [conversationId, viewerId]
  );
  return result.rows[0] || null;
}

async function getMessage(messageId, conversationId, viewerId, client = pool) {
  const result = await client.query(
    `SELECT
       m.*,
       sender.username AS sender_username,
       sender.display_name AS sender_display_name,
       sender.profile_img_url AS sender_avatar,
       reply.body AS reply_body,
       reply.sender_id AS reply_sender_id,
       reply.deleted_at AS reply_deleted_at,
       other.last_read_at AS other_last_read_at
     FROM public.messages m
     JOIN public.users sender ON sender.id = m.sender_id
     LEFT JOIN public.messages reply ON reply.id = m.reply_to_id
     LEFT JOIN public.conversation_members other
       ON other.conversation_id = m.conversation_id AND other.user_id <> $3
     WHERE m.id = $1 AND m.conversation_id = $2`,
    [messageId, conversationId, viewerId]
  );
  return result.rows[0] || null;
}

const mensajeController = {
  listConversations: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           c.id,
           c.last_message_at,
           mine.user_id AS viewer_id,
           mine.muted,
           other.user_id AS other_user_id,
           u.username AS other_username,
           u.display_name AS other_display_name,
           u.profile_img_url AS other_avatar,
           last_message.id AS last_message_id,
           last_message.body AS last_message_body,
           last_message.sender_id AS last_message_sender_id,
           last_message.created_at AS last_message_created_at,
           last_message.deleted_at AS last_message_deleted_at,
           COALESCE(unread.total, 0)::int AS unread_count,
           EXISTS (
             SELECT 1 FROM public.user_blocks ub
             WHERE (ub.blocker_id = mine.user_id AND ub.blocked_id = other.user_id)
                OR (ub.blocker_id = other.user_id AND ub.blocked_id = mine.user_id)
           ) AS blocked
         FROM public.conversations c
         JOIN public.conversation_members mine
           ON mine.conversation_id = c.id AND mine.user_id = $1
         JOIN public.conversation_members other
           ON other.conversation_id = c.id AND other.user_id <> $1
         JOIN public.users u ON u.id = other.user_id
         LEFT JOIN LATERAL (
           SELECT m.* FROM public.messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.id DESC LIMIT 1
         ) last_message ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS total
           FROM public.messages unread_message
           WHERE unread_message.conversation_id = c.id
             AND unread_message.sender_id <> $1
             AND unread_message.created_at > mine.last_read_at
             AND unread_message.deleted_at IS NULL
         ) unread ON true
         WHERE mine.archived_at IS NULL
         ORDER BY c.last_message_at DESC, c.id
         LIMIT 100`,
        [req.user.id]
      );
      return res.json(result.rows.map(mapConversation));
    } catch (error) {
      return handleError(res, error, 'No se pudieron cargar las conversaciones.');
    }
  },

  unreadCount: async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM public.messages m
         JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
         WHERE cm.user_id = $1
           AND m.sender_id <> $1
           AND m.created_at > cm.last_read_at
           AND m.deleted_at IS NULL`,
        [req.user.id]
      );
      return res.json({ noLeidos: Number(result.rows[0]?.total || 0) });
    } catch (error) {
      return handleError(res, error, 'No se pudo cargar el contador de mensajes.');
    }
  },

  createConversation: async (req, res) => {
    const targetUserId = String(req.body?.userId || '').trim();
    if (!UUID_PATTERN.test(targetUserId)) {
      return res.status(400).json({ error: 'El usuario destinatario no es valido.' });
    }
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'No podes iniciar una conversacion con vos mismo.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const target = await client.query('SELECT id FROM public.users WHERE id = $1', [targetUserId]);
      if (target.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'El usuario ya no esta disponible.' });
      }
      const block = await client.query(
        `SELECT 1 FROM public.user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)`,
        [req.user.id, targetUserId]
      );
      if (block.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'No se puede iniciar la conversacion debido a un bloqueo.' });
      }

      const directKey = [req.user.id, targetUserId].sort().join(':');
      const conversation = await client.query(
        `INSERT INTO public.conversations (direct_key, created_by)
         VALUES ($1, $2)
         ON CONFLICT (direct_key) DO UPDATE SET direct_key = EXCLUDED.direct_key
         RETURNING id`,
        [directKey, req.user.id]
      );
      const conversationId = conversation.rows[0].id;
      await client.query(
        `INSERT INTO public.conversation_members (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)
         ON CONFLICT (conversation_id, user_id) DO UPDATE
         SET archived_at = NULL`,
        [conversationId, req.user.id, targetUserId]
      );
      await client.query('COMMIT');
      const row = await getConversation(conversationId, req.user.id);
      return res.status(201).json(mapConversation(row));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      return handleError(res, error, 'No se pudo iniciar la conversacion.');
    } finally {
      client.release();
    }
  },

  listMessages: async (req, res) => {
    const { conversationId } = req.params;
    const before = req.query.before ? String(req.query.before) : null;
    const limit = clampLimit(req.query.limit);
    if (!UUID_PATTERN.test(conversationId) || (before && !/^\d+$/.test(before))) {
      return res.status(400).json({ error: 'El cursor o la conversacion no son validos.' });
    }

    try {
      const access = await getConversation(conversationId, req.user.id);
      if (!access) return res.status(404).json({ error: 'Conversacion no encontrada.' });
      const result = await pool.query(
        `SELECT
           m.*,
           sender.username AS sender_username,
           sender.display_name AS sender_display_name,
           sender.profile_img_url AS sender_avatar,
           reply.body AS reply_body,
           reply.sender_id AS reply_sender_id,
           reply.deleted_at AS reply_deleted_at,
           other.last_read_at AS other_last_read_at
         FROM public.messages m
         JOIN public.users sender ON sender.id = m.sender_id
         LEFT JOIN public.messages reply ON reply.id = m.reply_to_id
         LEFT JOIN public.conversation_members other
           ON other.conversation_id = m.conversation_id AND other.user_id <> $3
         WHERE m.conversation_id = $1
           AND ($2::bigint IS NULL OR m.id < $2::bigint)
         ORDER BY m.id DESC
         LIMIT $4`,
        [conversationId, before, req.user.id, limit + 1]
      );
      const hasMore = result.rows.length > limit;
      const selected = result.rows.slice(0, limit);
      const nextCursor = hasMore ? String(selected[selected.length - 1]?.id || '') : null;
      return res.json({
        items: selected.reverse().map((row) => mapMessage(row, req.user.id)),
        nextCursor,
        bloqueada: Boolean(access.blocked),
      });
    } catch (error) {
      return handleError(res, error, 'No se pudieron cargar los mensajes.');
    }
  },

  sendMessage: async (req, res) => {
    const { conversationId } = req.params;
    const body = normalizeMessage(req.body?.texto);
    const replyToId = req.body?.respuestaA == null ? null : String(req.body.respuestaA);
    if (!UUID_PATTERN.test(conversationId)) {
      return res.status(400).json({ error: 'La conversacion no es valida.' });
    }
    if (!body || body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `El mensaje debe tener entre 1 y ${MAX_MESSAGE_LENGTH} caracteres.` });
    }
    if (replyToId && !/^\d+$/.test(replyToId)) {
      return res.status(400).json({ error: 'El mensaje respondido no es valido.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const access = await getConversation(conversationId, req.user.id, client);
      if (!access) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Conversacion no encontrada.' });
      }
      if (access.blocked) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'No podes enviar mensajes en esta conversacion.' });
      }
      const rate = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM public.messages
         WHERE sender_id = $1
           AND created_at > NOW() - ($2::text || ' seconds')::interval`,
        [req.user.id, RATE_WINDOW_SECONDS]
      );
      if (Number(rate.rows[0]?.total || 0) >= RATE_MAX_MESSAGES) {
        await client.query('ROLLBACK');
        return res.status(429).json({ error: 'Estas enviando mensajes demasiado rapido. Espera unos segundos.' });
      }
      if (replyToId) {
        const reply = await client.query(
          'SELECT 1 FROM public.messages WHERE id = $1 AND conversation_id = $2',
          [replyToId, conversationId]
        );
        if (reply.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'El mensaje que queres responder ya no existe.' });
        }
      }
      const inserted = await client.query(
        `INSERT INTO public.messages (conversation_id, sender_id, body, reply_to_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [conversationId, req.user.id, body, replyToId]
      );
      await client.query(
        `UPDATE public.conversation_members
         SET last_read_at = timezone('utc'::text, now()), archived_at = NULL
         WHERE conversation_id = $1 AND user_id = $2`,
        [conversationId, req.user.id]
      );
      await client.query('COMMIT');
      const message = await getMessage(inserted.rows[0].id, conversationId, req.user.id);
      return res.status(201).json(mapMessage(message, req.user.id));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      return handleError(res, error, 'No se pudo enviar el mensaje.');
    } finally {
      client.release();
    }
  },

  markRead: async (req, res) => {
    const { conversationId } = req.params;
    if (!UUID_PATTERN.test(conversationId)) {
      return res.status(400).json({ error: 'La conversacion no es valida.' });
    }
    try {
      const result = await pool.query(
        `UPDATE public.conversation_members
         SET last_read_at = timezone('utc'::text, now())
         WHERE conversation_id = $1 AND user_id = $2
         RETURNING last_read_at`,
        [conversationId, req.user.id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Conversacion no encontrada.' });
      return res.json({ leidoEn: result.rows[0].last_read_at });
    } catch (error) {
      return handleError(res, error, 'No se pudo marcar la conversacion como leida.');
    }
  },

  editMessage: async (req, res) => {
    const messageId = String(req.params.messageId || '');
    const body = normalizeMessage(req.body?.texto);
    if (!/^\d+$/.test(messageId) || !body || body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'El mensaje editado no es valido.' });
    }
    try {
      const result = await pool.query(
        `UPDATE public.messages
         SET body = $1, edited_at = timezone('utc'::text, now())
         WHERE id = $2
           AND sender_id = $3
           AND deleted_at IS NULL
           AND created_at >= NOW() - INTERVAL '15 minutes'
         RETURNING conversation_id`,
        [body, messageId, req.user.id]
      );
      if (result.rowCount === 0) {
        return res.status(409).json({ error: 'Solo podes editar tus mensajes durante los primeros 15 minutos.' });
      }
      const message = await getMessage(messageId, result.rows[0].conversation_id, req.user.id);
      return res.json(mapMessage(message, req.user.id));
    } catch (error) {
      return handleError(res, error, 'No se pudo editar el mensaje.');
    }
  },

  deleteMessage: async (req, res) => {
    const messageId = String(req.params.messageId || '');
    if (!/^\d+$/.test(messageId)) {
      return res.status(400).json({ error: 'El mensaje no es valido.' });
    }
    try {
      const result = await pool.query(
        `UPDATE public.messages
         SET body = '', deleted_at = timezone('utc'::text, now()), edited_at = NULL
         WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [messageId, req.user.id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Mensaje no encontrado o sin permiso para eliminarlo.' });
      }
      return res.json({ ok: true, id: result.rows[0].id });
    } catch (error) {
      return handleError(res, error, 'No se pudo eliminar el mensaje.');
    }
  },
};

mensajeController._internals = {
  clampLimit,
  normalizeMessage,
  mapConversation,
  mapMessage,
};

module.exports = mensajeController;
