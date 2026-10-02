const assert = require('node:assert/strict');
const pool = require('../Pool_DB');

// Real PostgreSQL queries, isolated in temporary tables and always rolled back.
async function verify(idType) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path TO pg_temp, public');
    await client.query(`CREATE TEMP TABLE users (id uuid PRIMARY KEY, artist_name text, full_name text, username text, profile_img_url text)`);
    const actor = '11111111-1111-4111-8111-111111111111';
    const recipient = '22222222-2222-4222-8222-222222222222';
    const stranger = '33333333-3333-4333-8333-333333333333';
    await client.query('INSERT INTO users(id) VALUES ($1), ($2), ($3)', [actor, recipient, stranger]);
    if (idType === 'uuid') await client.query(`CREATE TEMP TABLE conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), direct_key text NOT NULL UNIQUE, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`);
    await client.query('CREATE TEMP TABLE user_blocks(blocker_id uuid, blocked_id uuid)');
    const query = (sql, params) => {
      if (sql.includes('information_schema.columns')) return Promise.resolve({ rows: [{ data_type: idType }] });
      if (sql === 'BEGIN') return client.query('SAVEPOINT message_action');
      if (sql === 'COMMIT') return client.query('RELEASE SAVEPOINT message_action');
      if (sql === 'ROLLBACK') return client.query('ROLLBACK TO SAVEPOINT message_action');
      return client.query(sql.replaceAll('public.', 'pg_temp.'), params);
    };
    require.cache[require.resolve('../Pool_DB')].exports = { query, connect: async () => ({ query, release() {} }) };
    require.cache[require.resolve('../services/moderationService')] = { exports: { asegurarEsquemaModeracion: async () => {} } };
    require.cache[require.resolve('../services/notificationService')] = { exports: { crearNotificacion: async () => {} } };
    delete require.cache[require.resolve('../services/messagesSchema')];
    delete require.cache[require.resolve('../Controllers/mensajeController')];
    const { asegurarEsquemaMensajes } = require('../services/messagesSchema');
    await asegurarEsquemaMensajes();
    await client.query('ALTER TABLE pg_temp.messages DROP COLUMN read_at');
    const controller = require('../Controllers/mensajeController');
    async function call(method, userId, { body = {}, id } = {}) {
      let status = 200, data;
      await controller[method]({ user: { id: userId }, body, params: { id } }, {
        status(value) { status = value; return this; }, json(value) { data = value; },
      });
      return { status, data };
    }
    assert.deepEqual((await call('listarConversaciones', actor)).data, []);
    const created = await call('crearConversacion', actor, { body: { recipientId: recipient } });
    assert.equal(created.status, 201);
    const id = created.data.id;
    assert.equal((await call('crearConversacion', recipient, { body: { recipientId: actor } })).data.id, id);
    assert.equal((await call('obtenerConversacion', actor, { id })).status, 200);
    assert.equal((await call('obtenerConversacion', stranger, { id })).status, 404);
    // An old timestamp makes read/unread comparisons deterministic within this transaction.
    await client.query("UPDATE pg_temp.conversation_members SET last_read_at = now() - interval '1 day'");
    assert.equal((await call('enviarMensaje', actor, { id, body: { text: 'Regression test' } })).status, 201);
    assert.equal((await call('listarConversaciones', recipient)).data[0].unread, 1);
    const opened = await call('obtenerConversacion', recipient, { id });
    assert.equal(opened.status, 200);
    assert.equal(opened.data.messages[0].text, 'Regression test');
    assert.equal(opened.data.messages[0].mine, false);
    assert.equal((await call('listarConversaciones', recipient)).data[0].unread, 0);
    assert.equal((await call('enviarMensaje', stranger, { id, body: { text: 'Denied' } })).status, 404);
    assert.equal((await call('obtenerConversacion', actor, { id: 'invalid' })).status, 400);
    console.log(`PASS ${idType}: list, create, reuse, open, send, unread, access control`);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}
(async () => {
  try { await verify('uuid'); await verify('bigint'); }
  catch (error) { console.error(error); process.exitCode = 1; }
  finally { await pool.end(); }
})();
