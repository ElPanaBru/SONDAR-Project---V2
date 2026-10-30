const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fuente = fs.readFileSync(path.join(__dirname, '../Controllers/perfilComunidadController.js'), 'utf8');
const funcion = fuente.slice(fuente.indexOf('async function puedeResponder('), fuente.indexOf('\nconst perfilComunidadController'));
function permiso(permitido) {
  const contexto = { pool: { query: async (sql, params) => {
    assert.doesNotMatch(sql, /follows/);
    assert.match(sql, /blocker_id = \$1 AND blocked_id = \$2/);
    assert.match(sql, /blocker_id = \$2 AND blocked_id = \$1/);
    assert.deepEqual(Array.from(params), ['visitante', 'autor']);
    return { rows: [{ permitido }] };
  } } };
  vm.createContext(contexto); vm.runInContext(funcion, contexto);
  return contexto.puedeResponder;
}
test('usuario autenticado puede responder sin seguir al autor', async () => {
  assert.equal(await permiso(true)('visitante', 'autor'), true);
});
test('un bloqueo en cualquier direccion impide responder', async () => {
  assert.equal(await permiso(false)('visitante', 'autor'), false);
});
test('visitante anonimo no puede responder', async () => {
  assert.equal(await permiso(true)(null, 'autor'), false);
});
test('el propietario puede responder en su comunidad', async () => {
  assert.equal(await permiso(true)('autor', 'autor'), true);
});
