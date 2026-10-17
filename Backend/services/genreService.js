const MUSIC_GENRES = Object.freeze(["pop","rock","metal","urbano","jazz","blues","funk","folklore"]);
const validGenres = new Set(MUSIC_GENRES);

function normalizeMusicGenres(value) {
  if (typeof value !== 'string') return null;
  const genres = [...new Set(value.toLowerCase().split(/\s*(?:\/|,|\|)\s*/).map(item => item.trim()))];
  if (!genres.length || genres.length > 3 || genres.some(genre => !validGenres.has(genre))) return null;
  return genres.join(' / ');
}

module.exports = { MUSIC_GENRES, normalizeMusicGenres };
