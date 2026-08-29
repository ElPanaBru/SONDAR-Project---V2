const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const senderId = '11111111-1111-4111-8111-111111111111';
const recipientId = '22222222-2222-4222-8222-222222222222';
const conversationId = '33333333-3333-4333-8333-333333333333';
const notificationCalls = [];
const poolQueries = [];

function result(rows = []) {
  return { rows, rowCount: rows.length };
}

const client = {
  async query(sql) {
    const query = String(sql).replace(/\s+/g, ' ').trim();
    if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') return result();
    if (query.startsWith('SELECT c.id,')) {
      return result([{
        id: conversationId,
        viewer_id: senderId,
        other_user_id: recipientId,
        other_deleted: false,
        blocked: false,
      }]);
    }
    if (query.startsWith('SELECT COUNT(*)::int AS total')) return result([{ total: 0 }]);
    if (query.startsWith('INSERT INTO public.messages')) return result([{ id: 91 }]);
    if (query.startsWith('UPDATE public.conversation_members')) return result();
    throw new Error(`Consulta inesperada del cliente: ${query}`);
  },
  release() {},
};

const pool = {
  async connect() {
    return client;
  },
  async query(sql, params = []) {
    const query = String(sql).replace(/\s+/g, ' ').trim();
    poolQueries.push({ query, params });
    if (query.startsWith('SELECT m.*,')) {
      return result([{
        id: 91,
        conversation_id: conversationId,
        sender_id: senderId,
        sender_username: 'tester',
        sender_display_name: 'Tester',
        sender_avatar: '',
        body: 'Hola desde la prueba',
        reply_to_id: null,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        other_last_read_at: null,
        other_last_delivered_at: null,
      }]);
    }
    if (query.startsWith('UPDATE public.conversation_members')) {
      return result([{ last_read_at: new Date().toISOString() }]);
    }
    if (query.startsWith('UPDATE public.notifications')) return result();
    throw new Error(`Consulta inesperada del pool: ${query}`);
  },
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '../Pool_DB') return pool;
  if (request === '../services/notificationService') {
    return {
      nombreActor: () => 'Tester',
      crearNotificacion: async (data, receivedClient) => {
        notificationCalls.push({ data, receivedClient });
        return { id: 1 };
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const mensajeController = require('../Controllers/mensajeController');
Module._load = originalLoad;

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('enviar un mensaje crea una notificacion configurable para el destinatario', async () => {
  const res = response();
  await mensajeController.sendMessage({
    params: { conversationId },
    body: { texto: 'Hola desde la prueba' },
    user: { id: senderId, email: 'tester@example.com' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.estado, 'enviado');
  assert.equal(notificationCalls.length, 1);
  assert.equal(notificationCalls[0].receivedClient, client);
  assert.deepEqual(notificationCalls[0].data, {
    userId: recipientId,
    actorId: senderId,
    type: 'direct_message',
    title: 'Tester te envio un mensaje',
    body: 'Hola desde la prueba',
    targetUrl: `/mensajes?conversacion=${conversationId}`,
    uniqueKey: `direct-message:91:${recipientId}`,
  });
});

test('leer una conversacion marca tambien sus notificaciones de mensajes como leidas', async () => {
  poolQueries.length = 0;
  const res = response();
  await mensajeController.markRead({
    params: { conversationId },
    user: { id: recipientId },
  }, res);

  assert.equal(res.statusCode, 200);
  const notificationUpdate = poolQueries.find(({ query }) => query.startsWith('UPDATE public.notifications'));
  assert.ok(notificationUpdate);
  assert.match(notificationUpdate.query, /type = 'direct_message'/);
  assert.deepEqual(notificationUpdate.params, [recipientId, `/mensajes?conversacion=${conversationId}`]);
  const memberUpdate = poolQueries.find(({ query }) => query.startsWith('UPDATE public.conversation_members'));
  assert.match(memberUpdate.query, /last_delivered_at/);
});

test('mapea las etapas de entrega y lectura', () => {
  const base = {
    id: 4,
    conversation_id: conversationId,
    sender_id: senderId,
    sender_username: 'tester',
    sender_display_name: 'Tester',
    body: 'Estado',
    created_at: '2026-08-29T12:00:00.000Z',
    deleted_at: null,
  };
  assert.equal(mensajeController._internals.mapMessage(base, senderId).estado, 'enviado');
  assert.equal(mensajeController._internals.mapMessage({
    ...base,
    other_last_delivered_at: '2026-08-29T12:00:01.000Z',
  }, senderId).estado, 'recibido');
  assert.equal(mensajeController._internals.mapMessage({
    ...base,
    other_last_delivered_at: '2026-08-29T12:00:01.000Z',
    other_last_read_at: '2026-08-29T12:00:02.000Z',
  }, senderId).estado, 'leido');
});

test('una conversacion conserva un participante eliminado como marcador', () => {
  const conversation = mensajeController._internals.mapConversation({
    id: conversationId,
    viewer_id: senderId,
    other_user_id: recipientId,
    other_deleted: true,
    unread_count: 0,
  });
  assert.deepEqual(conversation.usuario, {
    id: recipientId,
    username: '',
    nombre: 'Usuario eliminado',
    avatar: '',
    eliminado: true,
  });
});
