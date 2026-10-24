const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const usuario = { id: '11111111-1111-4111-8111-111111111111', email: 'cuenta@example.invalid' };
const pool = { query: async () => ({ rows: [], rowCount: 0 }) };
const auth = {
  signInWithPassword: async () => ({ data: { user: usuario }, error: null }),
  admin: { deleteUser: async () => { throw new Error('No debe eliminar durante el plazo de recuperacion'); } },
};
const originalLoad = Module._load;
let controller;
try {
  Module._load = function load(request, parent, isMain) {
    if (request === '../Pool_DB') return pool;
    if (request === '../services/supabaseClient') return { auth };
    if (request.startsWith('../services/') && request !== '../services/generos') return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  controller = require('../Controllers/usuarioController');
} finally { Module._load = originalLoad; }

function respuesta() {
  return { statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('programa la baja a siete dias solo para el usuario autenticado y no elimina Auth', async (t) => {
  const consultas = [];
  const fecha = '2026-10-30T12:00:00Z';
  t.mock.method(pool, 'query', async (sql, params) => {
    consultas.push({ sql, params });
    return { rowCount: 1, rows: [{ deletion_scheduled_at: fecha }] };
  });
  const res = respuesta();
  await controller.eliminarCuentaActual({ user: usuario, body: { password: 'prueba', userId: 'otra-cuenta' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, deletionScheduledAt: fecha });
  assert.equal(consultas.length, 1);
  assert.match(consultas[0].sql, /interval '7 days'/);
  assert.deepEqual(consultas[0].params, [usuario.id]);
});

test('no programa una baja con contrasena ausente, incorrecta o de otra cuenta', async (t) => {
  let escrituras = 0;
  t.mock.method(pool, 'query', async () => { escrituras++; return { rows: [] }; });
  let acceso;
  t.mock.method(auth, 'signInWithPassword', async () => acceso);
  for (const escenario of [
    { password: '', code: 400 },
    { password: 'incorrecta', code: 401, acceso: { data: {}, error: new Error('Credenciales invalidas') } },
    { password: 'otra', code: 401, acceso: { data: { user: { id: 'otro' } }, error: null } },
  ]) {
    acceso = escenario.acceso;
    const res = respuesta();
    await controller.eliminarCuentaActual({ user: usuario, body: { password: escenario.password } }, res);
    assert.equal(res.statusCode, escenario.code);
    assert.ok(res.body.error);
  }
  assert.equal(escrituras, 0);
});

test('no informa exito si la programacion falla o el perfil ya no existe', async (t) => {
  t.mock.method(console, 'error', () => {});
  let falla = true;
  t.mock.method(pool, 'query', async () => {
    if (falla) throw new Error('Base no disponible');
    return { rows: [], rowCount: 0 };
  });
  for (const errorBase of [true, false]) {
    falla = errorBase;
    const res = respuesta();
    await controller.eliminarCuentaActual({ user: usuario, body: { password: 'prueba' } }, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, undefined);
  }
});

test('recuperar solo cancela bajas futuras del usuario autenticado', async (t) => {
  let rowCount = 1;
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.match(sql, /deletion_requested_at = NULL, deletion_scheduled_at = NULL/);
    assert.match(sql, /WHERE id = \$1 AND deletion_scheduled_at > now\(\)/);
    assert.deepEqual(params, [usuario.id]);
    return { rows: rowCount ? [{ id: usuario.id }] : [], rowCount };
  });
  for (const existe of [true, false]) {
    rowCount = existe ? 1 : 0;
    const res = respuesta();
    await controller.recuperarCuentaPendiente({ user: usuario, body: { userId: 'otra-cuenta' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { success: true, recuperada: existe });
  }
});

test('verificar perfil conserva onboarding y la fecha de baja para iniciar sesion', async (t) => {
  const perfil = { ...usuario, onboarding_completed: true, deletion_scheduled_at: '2026-10-30T12:00:00Z' };
  t.mock.method(pool, 'query', async (sql, params) => {
    assert.match(sql, /AS onboarding_completed/);
    assert.deepEqual(params, [usuario.id]);
    return { rows: [perfil], rowCount: 1 };
  });
  const res = respuesta();
  await controller.verificarUsuario({ user: usuario }, res);
  assert.deepEqual(res.body, { existe: true, user: perfil });
});
