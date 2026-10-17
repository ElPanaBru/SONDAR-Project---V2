const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MUSIC_GENRES, normalizeMusicGenres } = require('../Backend/services/genreService');
const root = path.join(__dirname, '..');
for (const [file, pattern] of [
 ['sondar-mobile/constants/sondar.ts', /export const musicGenres = (\[[^\]]*\])/],
 ['Frontend/src/lib/generos.js', /export const GENEROS_MUSICALES = (\[[^\]]*\])/]
]) assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').match(pattern)[1]), MUSIC_GENRES);
for (const genre of MUSIC_GENRES) assert.equal(normalizeMusicGenres(genre.toUpperCase()), genre);
assert.equal(normalizeMusicGenres(' Urbano / Funk / Metal '), 'urbano / funk / metal');
assert.equal(normalizeMusicGenres('pop, pop'), 'pop');
for (const value of ['', 'trap', 'edm', 'cumbia', 'otros', 'rock / edm', 'pop / rock / metal / jazz', null]) assert.equal(normalizeMusicGenres(value), null);
console.log('Genre catalog and validation checks passed.');
