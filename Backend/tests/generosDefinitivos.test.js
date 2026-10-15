const test = require('node:test');
const assert = require('node:assert/strict');
const { GENEROS_MUSICALES, normalizarGeneroMusical } = require('../services/generos');
test('catalogo definitivo mantiene exactamente ocho categorias en orden', () => {
  assert.deepEqual(GENEROS_MUSICALES, ['pop', 'rock', 'metal', 'urbano', 'jazz', 'blues', 'funk', 'folklore']);
});
test('reagrupa subgeneros y conserva los generos definitivos', () => {
  for (const genero of GENEROS_MUSICALES) assert.equal(normalizarGeneroMusical(genero), genero);
  for (const genero of [' Trap ', 'RAP', 'reggaeton', 'cumbia', 'latina']) assert.equal(normalizarGeneroMusical(genero), 'urbano');
  for (const genero of ['punk', 'alternativo']) assert.equal(normalizarGeneroMusical(genero), 'rock');
  assert.equal(normalizarGeneroMusical('EDM'), 'pop');
  assert.equal(normalizarGeneroMusical('desconocido'), '');
  assert.equal(normalizarGeneroMusical(null), '');
});
