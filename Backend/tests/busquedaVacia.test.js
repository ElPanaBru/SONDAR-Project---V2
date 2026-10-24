const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const poolFalso = { query: async () => ({ rows: [] }) };
const originalLoad = Module._load;
let usuariosController;
try {
  Module._load = function cargarModulo(request, parent, isMain) {
    if (request === '../Pool_DB') return poolFalso;
    if (request.startsWith('../services/') && request !== '../services/generos') return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  usuariosController = require('../Controllers/usuarioController');
} finally {
  Module._load = originalLoad;
}

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('sin texto, sin parametro o con espacios se pueden explorar mas de 20 perfiles', async (t) => {
  const usuarios = Array.from({ length: 25 }, (_, indice) => ({
    id: `usuario-${indice}`,
    username: `artista${indice}`,
    display_name: `Artista ${indice}`,
    email: `privado${indice}@example.test`,
    password: 'dato-privado',
  }));
  const consultas = [];
  t.mock.method(poolFalso, 'query', async (sql, params) => {
    consultas.push({ sql, params });
    return { rows: /WHERE u.id = ANY/.test(sql) ? [{ id: 'usuario-0', seguidores: 7 }] : usuarios };
  });

  for (const query of [undefined, '', '   ']) {
    const res = crearRespuesta();
    await usuariosController.buscarUsuarios({ query: { query } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.length, 25);
    assert.equal(res.body[0].nombre, 'Artista 0');
    assert.equal(res.body[0].seguidores, 7);
    assert.ok(res.body.every((perfil) => !('email' in perfil) && !('password' in perfil)));
  }
  for (const { sql, params } of consultas.filter(({ sql }) => !/WHERE u.id = ANY/.test(sql))) {
    assert.doesNotMatch(sql, /\bWHERE\b|\bLIMIT\b/i);
    assert.match(sql, /ORDER BY lower\(COALESCE\(NULLIF\(display_name/);
    assert.deepEqual(params, []);
  }
});

test('buscar con texto conserva los filtros y la prioridad de coincidencias', async (t) => {
  let consulta;
  t.mock.method(poolFalso, 'query', async (sql, params) => {
    if (/WHERE u.id = ANY/.test(sql)) return { rows: [] };
    consulta = { sql, params };
    return { rows: [{ id: 'banda-id', username: 'banda', display_name: 'Banda' }] };
  });
  const res = crearRespuesta();
  await usuariosController.buscarUsuarios({ query: { query: '  banda  ' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].username, 'banda');
  assert.deepEqual(consulta.params, ['%banda%', 'banda']);
  assert.match(consulta.sql, /username ILIKE \$1/);
  assert.match(consulta.sql, /WHEN lower\(username\) = lower\(\$2\) THEN 0/);
  assert.match(consulta.sql, /LIMIT 20/);
});

test('un catalogo sin usuarios devuelve una lista vacia sin consultar estadisticas', async (t) => {
  const query = t.mock.method(poolFalso, 'query', async () => ({ rows: [] }));
  const res = crearRespuesta();
  await usuariosController.buscarUsuarios({ query: {} }, res);
  assert.deepEqual(res.body, []);
  assert.equal(query.mock.callCount(), 1);
});
