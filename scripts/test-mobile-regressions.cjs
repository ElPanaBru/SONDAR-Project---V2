const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');

function middleware({ exists = true, invalid = false, unavailable = false } = {}) {
  const module = { exports: {} };
  let queries = 0;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'Backend/middlewares/authMiddleware.js'), 'utf8'), {
    module, console: { error() {} },
    require(name) {
      if (name.endsWith('Pool_DB')) return { query: async () => {
        queries++;
        if (unavailable) throw new Error('database unavailable');
        return { rowCount: exists ? 1 : 0 };
      } };
      return { auth: { getUser: async () => ({ data: { user: invalid ? null : { id: 'test-user' } }, error: invalid }) } };
    },
  });
  return { handler: module.exports, queries: () => queries };
}
async function request(handler, authenticated = true) {
  const result = { next: false, status: 200, body: null };
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; } };
  await handler({ headers: authenticated ? { authorization: 'Bearer test' } : {} }, res, () => { result.next = true; });
  return result;
}
for (const optional of [false, true]) {
  test('deleted profile is rejected; optional=' + optional, async () => {
    const { handler } = middleware({ exists: false });
    const result = await request(optional ? handler.opcional : handler);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'PROFILE_MISSING');
    assert.equal(result.next, false);
  });
  test('existing profile can continue; optional=' + optional, async () => {
    const { handler } = middleware();
    assert.equal((await request(optional ? handler.opcional : handler)).next, true);
  });
  test('database outage is not reported as deleted account; optional=' + optional, async () => {
    const { handler } = middleware({ unavailable: true });
    const result = await request(optional ? handler.opcional : handler);
    assert.equal(result.status, 503);
    assert.equal(result.body.code, undefined);
    assert.equal(result.next, false);
  });
}
test('invalid token cannot reach profile lookup', async () => {
  const { handler, queries } = middleware({ invalid: true });
  assert.equal((await request(handler)).status, 401);
  assert.equal(queries(), 0);
});
test('public anonymous requests are allowed only by optional middleware', async () => {
  const { handler, queries } = middleware();
  assert.equal((await request(handler, false)).status, 401);
  assert.equal((await request(handler.opcional, false)).next, true);
  assert.equal(queries(), 0);
});

const ts = require(path.join(root, 'sondar-mobile/node_modules/typescript'));
function loadTs(relative, imports = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => imports[name] || {} });
  return module.exports;
}
test('forum replies normalize handles exactly once and retain nesting', () => {
  const { normalizeComment } = loadTs('sondar-mobile/lib/normalizers.ts');
  const comment = normalizeComment({ id: '10', usuario: '@@ana', responde_a: '@@bea', parent_id: '2', respuestas: [{ id: '11', username: 'cami' }] });
  assert.equal(comment.usuario, '@ana');
  assert.equal(comment.respondeA, '@bea');
  assert.equal(comment.parentId, 2);
  assert.equal(comment.respuestas[0].usuario, '@cami');
});
test('audio upload preserves extension for MIME inference', () => {
  const { mediaPart } = loadTs('sondar-mobile/lib/api.ts');
  const asset = { uri: 'file:///cache/recording', name: 'recording.m4a' };
  const part = mediaPart({ ...asset, fileName: asset.name }, 'audio.mp3');
  assert.equal(part.name, 'recording.m4a');
  assert.equal(part.type, 'audio/mp4');
});
