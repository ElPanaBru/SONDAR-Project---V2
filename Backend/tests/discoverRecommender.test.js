const test = require('node:test');
const assert = require('node:assert/strict');
const { scorePreview, diversifyPreviews, DEFAULT_CONFIG, createConfig } = require('../services/discoverRecommender');

const profile = { genreAffinities: { rock: 1, jazz: 0.8, pop: 0.1 } };
const ids = (items) => items.map(({ id }) => id);
const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-10, `${value} != ${expected}`);
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('cold start conserva frescura y descubrimiento sin inventar afinidades', () => {
  close(scorePreview({}, { ageDays: 0, exposureCount: 0, genres: ['rock'] }), 20);
  assert.equal(scorePreview({}, {}), 0);
});

test('perfil con varios generos considera todos los de cada preview', () => {
  close(scorePreview(profile, { genres: ['rock'] }), 65);
  close(scorePreview(profile, { genres: ['jazz'] }), 52);
  close(scorePreview(profile, { genres: ['rock', 'jazz'] }), 58.5);
  close(scorePreview(profile, { genres: ['pop', 'rock'] }), 35.75);
  close(scorePreview(profile, { genres: ['rock', 'pop'] }), 35.75);
});

test('pesos multigenero se normalizan sin inflarse por etiquetas duplicadas', () => {
  const genres = [{ genre: 'rock', weight: 3 }, { genre: 'pop', weight: 1 }];
  close(scorePreview(profile, { genres }), 50.375);
  close(scorePreview(profile, { genres: [...genres, { genre: ' ROCK ', weight: 2 }] }), 50.375);
  close(scorePreview(profile, { genres: [{ genre: 'rock', weight: 0 }, 'jazz'] }), 52);
});

test('afinidad por creador solo aporta con identidad conocida y fiable', () => {
  const user = { creatorAffinities: { a: { affinity: 1, reliable: true }, b: { affinity: 1, reliable: false },
    undefined: { affinity: 1, reliable: true } } };
  assert.equal(scorePreview(user, { creatorId: 'a' }), 15);
  assert.equal(scorePreview(user, { creatorId: 'b' }), 0);
  assert.equal(scorePreview(user, { creatorId: 'unknown' }), 0);
  assert.equal(scorePreview(user, {}), 0);
});

test('poca exposicion y frescura tienen bonos acotados; ausencia no equivale a cero exposicion', () => {
  close(scorePreview({}, { exposureCount: 0 }), 10);
  close(scorePreview({}, { exposureCount: 100 }), 5);
  assert.ok(scorePreview({}, { exposureCount: 1000 }) < scorePreview({}, { exposureCount: 100 }));
  close(scorePreview({}, { ageDays: 14 }), 5);
  assert.equal(scorePreview({}, { ageDays: -1, exposureCount: -1 }), 0);
});

test('configuracion parcial cambia pesos sin mutar defaults y rechaza parametros invalidos', () => {
  const config = createConfig({ weights: { genre: 1, creator: 0, freshness: 0, discovery: 0 } });
  assert.equal(scorePreview(profile, { genres: ['rock'] }, config), 100);
  assert.equal(DEFAULT_CONFIG.weights.genre, 0.65);
  assert.ok(Object.isFrozen(config.weights));
  for (const invalid of [
    { weights: { genre: Infinity } }, { weights: { genre: -1 } },
    { weights: { genre: 0, creator: 0, freshness: 0, discovery: 0 } },
    { diversity: { windowSize: -1 } }, { diversity: { creatorPenalty: NaN } },
    { freshnessHalfLifeDays: 0 }, { exposureScale: 0 },
  ]) assert.throws(() => createConfig(invalid), RangeError);
});

test('datos incompletos y extremos producen puntajes finitos dentro de 0..100', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -10, 0, 0.5, 1, 1e308]) {
    const user = { genreAffinities: { rock: value }, creatorAffinities: { a: { affinity: value, reliable: true } } };
    const preview = { genres: ['rock', null, {}, { genre: 'pop', weight: Infinity }], creatorId: 'a', ageDays: value, exposureCount: value };
    const score = scorePreview(user, preview);
    assert.ok(Number.isFinite(score) && score >= 0 && score <= 100);
  }
  assert.equal(scorePreview(null, null), 0);
  close(scorePreview({ genreAffinities: { rock: 1, jazz: 1 } }, {
    genres: [{ genre: 'rock', weight: Number.MAX_VALUE }, { genre: 'jazz', weight: Number.MAX_VALUE }],
  }), 65);
  close(scorePreview({ ...profile, creatorAffinities: { a: { affinity: 1, reliable: true } } },
    { genres: ['rock'], creatorId: 'a', ageDays: 0, exposureCount: 0 }), 100);
});

test('funciones deterministas no mutan perfil, configuracion ni objetos y arrays de previews', () => {
  const user = freeze(structuredClone(profile));
  const config = freeze({ weights: { genre: 0.7 }, diversity: { windowSize: 2 } });
  const input = freeze([{ id: 'b', genres: ['rock'], score: 65 }, { id: 'a', genres: ['jazz'], score: 52 }]);
  const before = structuredClone(input);
  const score = scorePreview(user, input[0], config);
  assert.equal(scorePreview(user, input[0], config), score);
  const output = diversifyPreviews(input, config);
  assert.notEqual(output, input);
  assert.deepEqual(input, before);
  assert.deepEqual(output, diversifyPreviews(input, config));
  assert.ok(output.every((item) => input.includes(item)));
});

test('empates se resuelven por ID independientemente del orden de entrada', () => {
  const items = [{ id: 'c', score: 50 }, { id: 'a', score: 50 }, { id: 'b', score: 50 }];
  assert.deepEqual(ids(diversifyPreviews(items)), ['a', 'b', 'c']);
  assert.deepEqual(diversifyPreviews(items), diversifyPreviews([...items].reverse()));
});

test('diversificacion intercala generos y creadores cercanos en relevancia', () => {
  const input = [
    { id: 'a', genres: ['rock'], creatorId: 'x', score: 90 },
    { id: 'b', genres: ['rock'], creatorId: 'x', score: 89 },
    { id: 'c', genres: ['jazz'], creatorId: 'y', score: 88 },
  ];
  assert.deepEqual(ids(diversifyPreviews(input)), ['a', 'c', 'b']);
});

test('penalizaciones funcionan separadas y conservan diferencias grandes de relevancia', () => {
  const sameGenre = [{ id: 'a', genres: ['rock'], score: 90 }, { id: 'b', genres: ['rock'], score: 89 }, { id: 'c', genres: ['jazz'], score: 88 }];
  assert.deepEqual(ids(diversifyPreviews(sameGenre)), ['a', 'c', 'b']);
  const sameCreator = sameGenre.map((item) => ({ id: item.id, score: item.score, creatorId: item.id === 'c' ? 'y' : 'x' }));
  assert.deepEqual(ids(diversifyPreviews(sameCreator)), ['a', 'c', 'b']);
  assert.deepEqual(ids(diversifyPreviews([{ ...sameGenre[0], score: 100 }, { ...sameGenre[1], score: 95 }, { ...sameGenre[2], score: 1 }])), ['a', 'b', 'c']);
});

test('coincidencia de genero secundario tambien diversifica', () => {
  const items = [{ id: 'a', score: 90, genres: ['rock', 'jazz'] }, { id: 'b', score: 89, genres: ['jazz'] }, { id: 'c', score: 88, genres: ['pop'] }];
  assert.deepEqual(ids(diversifyPreviews(items)), ['a', 'c', 'b']);
});

test('catalogos vacios, unitarios y sin variedad conservan todos los validos sin duplicar', () => {
  assert.deepEqual(diversifyPreviews([]), []);
  const item = { id: 1, score: 50, genres: ['rock'], creatorId: 'x' };
  assert.deepEqual(diversifyPreviews([item]), [item]);
  const input = Array.from({ length: 10 }, (_, i) => ({ ...item, id: i, score: 100 - i }));
  const output = diversifyPreviews(input);
  assert.equal(output.length, input.length);
  assert.equal(new Set(ids(output)).size, input.length);
  assert.deepEqual(new Set(output), new Set(input));
});

test('ventana cero desactiva penalizaciones; datos ausentes no crean coincidencias', () => {
  const items = [{ id: 'a', score: 50 }, { id: 'b', score: 49 }, { id: 'c', score: 48, genres: ['rock'] }];
  assert.deepEqual(ids(diversifyPreviews(items)), ['a', 'b', 'c']);
  const repeated = items.map((item) => ({ ...item, genres: ['rock'], creatorId: item.id === 'c' ? 'y' : 'x' }));
  assert.deepEqual(ids(diversifyPreviews(repeated, { diversity: { windowSize: 0 } })), ['a', 'b', 'c']);
});

test('invalidos se omiten y duplicados de entrada se rechazan explicitamente', () => {
  const input = [null, {}, { id: 'bad', score: NaN }, { id: 'bad2', score: 101 }, { id: '', score: 5 }, { id: 'ok', score: 0 }];
  assert.deepEqual(ids(diversifyPreviews(input)), ['ok']);
  assert.throws(() => diversifyPreviews(null), TypeError);
  assert.throws(() => diversifyPreviews([{ id: 1, score: 0 }, { id: '1', score: 10 }]), RangeError);
});
