const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const previous = Module._extensions['.ts'];
let genres, normalizers, constants;
try {
  Module._extensions['.ts'] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    module._compile(outputText, filename);
  };
  genres = require('../lib/genres.ts');
  normalizers = require('../lib/normalizers.ts');
  constants = require('../constants/sondar.ts');
} finally {
  if (previous) Module._extensions['.ts'] = previous;
  else delete Module._extensions['.ts'];
}

test('onboarding, filtros y formularios reciben los mismos siete generos de web', () => {
  const expected = ['pop', 'rock', 'urbano', 'jazz', 'blues', 'funk', 'folklore'];
  assert.deepEqual(constants.musicGenres, expected);
  assert.deepEqual(constants.genres, ['todos', ...expected]);
  assert.deepEqual(constants.musicGenres, require('../../shared/generos.json').catalogo.map(item => item.slug));
});

test('normaliza listas y textos heredados sin duplicar etiquetas ni inventar metal como pop', () => {
  assert.deepEqual(genres.normalizeGenres(' Rock / Jazz | rock '), ['rock', 'jazz']);
  assert.deepEqual(genres.normalizeGenres(['trap', 'cumbia', 'soul']), ['urbano', 'funk']);
  for (const value of [null, '', 'metal', 'reggae', 'desconocido']) assert.deepEqual(genres.normalizeGenres(value), []);
});

test('preview recomendada conserva todos los generos, fragmentos y estados sociales', () => {
  const reel = normalizers.normalizeReel({ id: 9, genero: 'rock', generos: ['rock', 'jazz'], titulo: 'Tema', fragment_start: 12, fragment_end: 42, liked: true, guardado: true, siguiendo: true, audio_url: '/audio.wav' });
  assert.deepEqual(reel.generos, ['rock', 'jazz']);
  assert.equal(reel.genero, 'rock / jazz');
  assert.equal(reel.tema, 'Tema');
  assert.equal(reel.audio, '/audio.wav');
  assert.equal(reel.fragmentStart, 12);
  assert.equal(reel.fragmentEnd, 42);
  assert.ok(reel.liked && reel.guardado && reel.siguiendo);
  assert.equal(reel.backendId, 9);
});

test('previews antiguas con generos concatenados siguen mostrando sus etiquetas validas', () => {
  const reel = normalizers.normalizeReel({ id: 1, genero: 'jazz / funk' });
  assert.deepEqual(reel.generos, ['jazz', 'funk']);
  assert.equal(reel.genero, 'jazz / funk');
});
