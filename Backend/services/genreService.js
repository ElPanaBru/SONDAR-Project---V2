const { GENEROS_MUSICALES, normalizarGeneroMusical } = require('./generos');
const MUSIC_GENRES = Object.freeze([...GENEROS_MUSICALES]);
const validGenres = new Set(MUSIC_GENRES);

function normalizeMusicGenres(value) {
  if (typeof value !== 'string') return null;
  const genres = [...new Set(value.toLowerCase().split(/\s*(?:\/|,|\|)\s*/).map(item => item.trim()))];
  if (!genres.length || genres.length > 3 || genres.some(genre => !validGenres.has(genre))) return null;
  return genres.join(' / ');
}

// Lectura de etiquetas historicas; las altas siguen validando el catalogo actual.
function parseMusicGenres(value) {
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item || '').split(/\s*(?:\/|,|\|)\s*/));
  return [...new Set(parts.map(normalizarGeneroMusical).filter(Boolean))];
}
module.exports = { MUSIC_GENRES, normalizeMusicGenres, parseMusicGenres };
