const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { loadRecommendedReels } = require('../services/discoverRecommender/mobileFeed');
const { rankCandidates } = require('../services/discoverRecommender/recommend');
const { MUSIC_GENRES, normalizeMusicGenres, parseMusicGenres } = require('../services/genreService');
const viewer = '11111111-1111-4111-8111-111111111111';
const creator = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-23T12:00:00Z');
const candidates = [
  { id: 1, genero: 'rock / jazz', generos: ['rock / jazz'], titulo: 'Dos generos', creador_id: creator, created_at: now, visitas_calculadas: 4, likes_calculados: 3, guardados_calculados: 2, compartidos_calculados: 1, fragment_start: 10, fragment_end: 40, audio_url: '/audio.wav' },
  { id: 2, genero: 'pop', generos: ['pop'], titulo: 'Pop', creador_id: '33333333-3333-4333-8333-333333333333', created_at: now, visitas_calculadas: 4 },
  { id: 3, genero: 'metal', generos: ['metal'], titulo: 'Historico', creador_id: creator, created_at: now },
];
function database(overrides = {}) {
  const state = { schema: { multi_genre: false, mobile_interests: true, web_interests: false }, candidates,
    mobile: [{ genero: 'jazz' }], web: [], liked: [{ genres: ['rock / jazz'] }], saved: [{ genres: ['jazz'] }], followed: [{ following_id: creator }], ...overrides };
  const queries = [];
  return { queries, async query(sql, params) {
    queries.push({ sql, params });
    if (sql.includes("to_regclass('public.reel_generos')")) return { rows: [state.schema] };
    if (sql.includes('FROM reels r LEFT JOIN users')) return { rows: state.candidates };
    if (sql.includes('SELECT genero FROM user_genre_preferences')) return { rows: state.mobile };
    if (sql.includes('SELECT genre FROM user_interests')) return { rows: state.web };
    if (sql.includes('JOIN reels r ON r.id = rl.reel_id')) return { rows: state.liked };
    if (sql.includes('JOIN reels r ON r.id = rs.reel_id')) return { rows: state.saved };
    if (sql.includes('FROM follows') && sql.includes('LIMIT 500')) return { rows: state.followed };
    if (sql.includes('reel_id = ANY')) return { rows: [{ reel_id: 1 }] };
    if (sql.includes('following_id = ANY')) return { rows: [{ following_id: creator }] };
    return { rows: [], rowCount: 0 };
  } };
}

test('catalogo unico de siete generos; altas rechazan retirados sin reclasificarlos', () => {
  assert.deepEqual(MUSIC_GENRES, ['pop', 'rock', 'urbano', 'jazz', 'blues', 'funk', 'folklore']);
  assert.equal(normalizeMusicGenres(' ROCK / Jazz / rock '), 'rock / jazz');
  for (const value of ['metal', 'reggae', 'rock / metal', '', 'pop / rock / jazz / funk']) assert.equal(normalizeMusicGenres(value), null);
  assert.deepEqual(parseMusicGenres(['trap / rock', 'jazz', 'rock', 'metal']), ['urbano', 'rock', 'jazz']);
});

test('adapta generos concatenados y preferencias moviles al mismo ranking de web', async () => {
  const pool = database();
  const result = await loadRecommendedReels(pool, viewer, null, { now });
  const expected = rankCandidates(candidates.slice(0, 2).map(reel => ({ ...reel, generos: parseMusicGenres(reel.generos) })), {
    interests: ['jazz'], liked: [{ genres: ['rock', 'jazz'] }], saved: [{ genres: ['jazz'] }], followedCreatorIds: [creator],
  }, { now });
  assert.deepEqual(result, expected);
  assert.deepEqual(result.find(reel => reel.id === 1).generos, ['rock', 'jazz']);
  assert.ok(!result.some(reel => reel.id === 3));
  const selection = pool.queries.find(q => q.sql.includes('FROM reels r LEFT JOIN users'));
  assert.match(selection.sql, /user_blocks/);
  assert.deepEqual(selection.params, [viewer, null]);
  for (const q of pool.queries.filter(q => q.sql.includes('JOIN reels r ON r.id'))) {
    assert.match(q.sql, /INTERVAL '180 days'/);
    assert.match(q.sql, /LIMIT 500/);
    assert.deepEqual(q.params, [viewer]);
  }
});

test('anonimos no consultan afinidades; catalogos vacios y pequenos siguen funcionando', async () => {
  for (const rows of [[], candidates.slice(0, 1)]) {
    const pool = database({ candidates: rows });
    const result = await loadRecommendedReels(pool, null, null, { now });
    assert.equal(result.length, rows.length);
    assert.equal(pool.queries.length, 2);
    assert.deepEqual(pool.queries[1].params, [null, null]);
  }
});

test('usa relaciones multigenero y preferencias web si no hay onboarding movil', async () => {
  const pool = database({ schema: { multi_genre: true, mobile_interests: false, web_interests: true }, web: [{ genre: 'funk' }] });
  await loadRecommendedReels(pool, viewer, creator, { now });
  assert.match(pool.queries[1].sql, /array_agg\(rg.genero ORDER BY rg.posicion\)/);
  assert.deepEqual(pool.queries[1].params, [viewer, creator]);
  assert.ok(pool.queries.some(q => q.sql.includes('SELECT genre FROM user_interests')));
  assert.ok(!pool.queries.some(q => q.sql.includes('SELECT genero FROM user_genre_preferences')));
});

test('fallos de base se propagan en lugar de aparentar un perfil sin preferencias', async () => {
  const pool = database();
  const original = pool.query;
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT genero FROM user_genre_preferences')) throw new Error('Sin conexion');
    return original.call(pool, sql, params);
  };
  await assert.rejects(loadRecommendedReels(pool, viewer), /Sin conexion/);
});

const pool = database();
const originalLoad = Module._load;
let controller;
try {
  Module._load = function load(request, parent, isMain) {
    if (request === '../Pool_DB') return pool;
    if (request === '../services/supabaseClient') return {};
    if (request === '../services/moderationService') return { asegurarEsquemaModeracion: async () => {} };
    if (['../services/storageService', '../services/notificationService'].includes(request)) return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  controller = require('../Controllers/reelController');
} finally { Module._load = originalLoad; }
const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });

test('endpoint conserva contrato movil e interacciones y usa identidad autenticada', async () => {
  const res = response();
  await controller.listarDescubrir({ user: { id: viewer }, query: { userId: 'otro', interests: ['pop'] } }, res);
  assert.equal(res.statusCode, 200);
  const item = res.body.find(reel => reel.id === 1);
  assert.equal(item.tema, 'Dos generos');
  assert.equal(item.audio, '/audio.wav');
  assert.equal(item.fragmentStart, 10);
  assert.equal(item.fragmentEnd, 40);
  assert.deepEqual(item.generos, ['rock', 'jazz']);
  assert.equal(item.likes, 3);
  assert.equal(item.guardados, 2);
  assert.equal(item.compartidos, 1);
  assert.equal(item.visitas, 4);
  assert.equal(item.liked, true);
  assert.equal(item.guardado, true);
  assert.equal(item.siguiendo, true);
  assert.ok(pool.queries.filter(q => q.sql.includes('user_genre_preferences')).every(q => !q.params || q.params[0] === viewer));
});

test('endpoint rechaza filtro de creador invalido antes de consultar datos', async () => {
  const before = pool.queries.length;
  const res = response();
  await controller.listarDescubrir({ user: null, query: { creador: 'invalido' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(pool.queries.length, before);
});
