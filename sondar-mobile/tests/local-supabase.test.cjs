const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { once } = require('node:events');
const test = require('node:test');
const ts = require('typescript');

function loadConfig(host, overrides = {}) {
  const filename = path.resolve(__dirname, '../lib/config.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, URL,
    process: { env: {
      EXPO_PUBLIC_SUPABASE_LOCAL: 'true', EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'public-local-key', ...overrides,
    } },
    require: name => {
      assert.equal(name, 'expo-constants');
      return { __esModule: true, default: { expoConfig: { hostUri: host } } };
    },
  });
  return module.exports;
}

test('LAN uses Expo for Auth and rewrites local media, preserving query parameters', () => {
  const config = loadConfig('192.168.1.5:8081');
  assert.equal(config.API_URL, 'http://192.168.1.5:8081');
  assert.equal(config.SUPABASE_URL, 'http://192.168.1.5:8081/supabase');
  assert.equal(config.IS_SUPABASE_CONFIGURED, true);
  assert.equal(config.localMediaUrl('http://127.0.0.1:55321/storage/v1/object/public/reels/audio.mp3?x=1'),
    'http://192.168.1.5:8081/supabase/storage/v1/object/public/reels/audio.mp3?x=1');
  for (const value of ['Texto', '/imagen.png', 'https://cloud.supabase.co/storage/v1/object/public/a.png',
    'http://127.0.0.1:54321/storage/v1/object/public/a.png']) {
    assert.equal(config.localMediaUrl(value), value);
  }
});

test('Expo tunnel and web resolve Auth and media on their reachable origin', () => {
  const tunnel = loadConfig('phone.example.exp.direct');
  assert.equal(tunnel.SUPABASE_URL, 'https://phone.example.exp.direct/supabase');
  const web = loadConfig('localhost:8081');
  assert.equal(web.SUPABASE_URL, 'http://localhost:8081/supabase');
});

test('explicit remote mode preserves remote Auth, API and media URLs', () => {
  const config = loadConfig('192.168.1.5:8081', {
    EXPO_PUBLIC_SUPABASE_LOCAL: 'false', EXPO_PUBLIC_SUPABASE_URL: 'https://cloud.supabase.co',
    EXPO_PUBLIC_API_URL: 'https://api.example.com/',
  });
  assert.equal(config.SUPABASE_URL, 'https://cloud.supabase.co');
  assert.equal(config.API_URL, 'https://api.example.com');
  const media = 'http://127.0.0.1:55321/storage/v1/object/public/a.png';
  assert.equal(config.localMediaUrl(media), media);
});

test('Metro forwards auth bodies, API routes and audio Range requests to local services', async t => {
  const upstream = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (req.url.startsWith('/storage/v1/')) {
      assert.equal(req.headers.range, 'bytes=1-3');
      res.writeHead(206, { 'Content-Range': 'bytes 1-3/5', 'Content-Type': 'audio/mpeg' });
      return res.end(Buffer.from([2, 3, 4]));
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ url: req.url, method: req.method,
      apikey: req.headers.apikey, body: Buffer.concat(chunks).toString() }));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  t.after(() => upstream.close());
  const origin = `http://127.0.0.1:${upstream.address().port}`;
  const module = { exports: {} };
  const filename = path.resolve(__dirname, '../metro.config.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, URL, __dirname: path.dirname(filename),
    process: { env: { SONDAR_LOCAL_API_URL: origin, SONDAR_LOCAL_SUPABASE_URL: origin } },
    require: name => name === 'expo/metro-config' ? { getDefaultConfig: () => ({ server: {} }) } : require(name),
  });
  const middleware = module.exports.server.enhanceMiddleware((_req, res) => { res.statusCode = 404; res.end(); });
  const proxy = http.createServer((req, res) => middleware(req, res, () => {}));
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  t.after(() => proxy.close());
  const base = `http://127.0.0.1:${proxy.address().port}`;
  const auth = await fetch(`${base}/supabase/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: 'anon-only', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'local@example.test', password: 'test-password' }),
  });
  const result = await auth.json();
  assert.equal(result.url, '/auth/v1/token?grant_type=password');
  assert.equal(result.method, 'POST');
  assert.equal(result.apikey, 'anon-only');
  assert.equal(JSON.parse(result.body).email, 'local@example.test');
  assert.equal((await (await fetch(`${base}/api/health?database=1`)).json()).url, '/api/health?database=1');
  const audio = await fetch(`${base}/supabase/storage/v1/object/public/reels/audio.mp3`, { headers: { Range: 'bytes=1-3' } });
  assert.equal(audio.status, 206);
  assert.equal(audio.headers.get('content-range'), 'bytes 1-3/5');
  assert.deepEqual(Buffer.from(await audio.arrayBuffer()), Buffer.from([2, 3, 4]));
});
