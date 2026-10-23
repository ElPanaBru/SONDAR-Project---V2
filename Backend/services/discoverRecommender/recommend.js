const { scorePreview, diversifyPreviews } = require('./index');
const { normalizarGeneroMusical } = require('../generos');

function buildProfile({ interests = [], liked = [], saved = [], followedCreatorIds = [] } = {}) {
  const genreWeights = new Map();
  const addGenres = (genres, weight) => {
    for (const value of Array.isArray(genres) ? genres : []) {
      const genre = normalizarGeneroMusical(value);
      if (genre) genreWeights.set(genre, (genreWeights.get(genre) || 0) + weight);
    }
  };
  addGenres(interests, 1);
  for (const reel of liked) addGenres(reel.genres, 1.5);
  for (const reel of saved) addGenres(reel.genres, 2);

  const max = Math.max(0, ...genreWeights.values());
  const genreAffinities = Object.fromEntries([...genreWeights]
    .map(([genre, weight]) => [genre, max ? weight / max : 0]));
  const creatorAffinities = Object.fromEntries([...new Set(followedCreatorIds.filter(Boolean))]
    .map((creatorId) => [String(creatorId), { affinity: 1, reliable: true }]));
  return { genreAffinities, creatorAffinities };
}

function rankCandidates(candidates, profileSignals = {}, options = {}) {
  const now = options.now instanceof Date ? options.now.getTime() : Date.now();
  const profile = buildProfile(profileSignals);
  const scored = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    const genres = [...new Set((Array.isArray(candidate.generos) && candidate.generos.length
      ? candidate.generos : [candidate.genero]).map(normalizarGeneroMusical).filter(Boolean))];
    const createdAt = new Date(candidate.created_at).getTime();
    const ageDays = Number.isFinite(createdAt) ? Math.max(0, (now - createdAt) / 86400000) : undefined;
    return {
      ...candidate,
      generos: genres.length ? genres : ['pop'],
      genres: genres.length ? genres : ['pop'],
      creatorId: candidate.creador_id,
      ageDays,
      exposureCount: Number.isFinite(Number(candidate.visitas_calculadas))
        ? Math.max(0, Number(candidate.visitas_calculadas)) : undefined,
    };
  }).map((candidate) => ({ ...candidate, score: scorePreview(profile, candidate) }));

  return diversifyPreviews(scored, options.config);
}

module.exports = { buildProfile, rankCandidates };
