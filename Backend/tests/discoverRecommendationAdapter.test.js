const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfile, rankCandidates } = require('../services/discoverRecommender/recommend');

const now = new Date('2026-10-23T12:00:00.000Z');

test('perfil combina intereses, likes, guardados y creadores seguidos con géneros canónicos', () => {
  const profile = buildProfile({
    interests: ['rock', 'trap', 'no-valido'],
    liked: [{ genres: ['jazz', 'rock'] }],
    saved: [{ genres: ['funk'] }],
    followedCreatorIds: ['artist-1', 'artist-1'],
  });
  assert.deepEqual(profile.genreAffinities, { rock: 1, urbano: 0.4, jazz: 0.6, funk: 0.8 });
  assert.deepEqual(profile.creatorAffinities, { 'artist-1': { affinity: 1, reliable: true } });
});

test('el ranking usa todos los géneros de reel_generos y respeta la diversificación en fixtures', () => {
  const result = rankCandidates([
    { id: 1, creador_id: 'a', genero: 'rock', generos: ['rock', 'jazz'], created_at: '2026-10-22T12:00:00Z', visitas_calculadas: 2 },
    { id: 2, creador_id: 'a', genero: 'rock', generos: ['rock'], created_at: '2026-10-22T10:00:00Z', visitas_calculadas: 2 },
    { id: 3, creador_id: 'b', genero: 'funk', generos: ['funk'], created_at: '2026-10-21T12:00:00Z', visitas_calculadas: 1 },
  ], { interests: ['rock', 'jazz'] }, { now });
  assert.deepEqual(result.map((reel) => reel.id), [1, 2, 3]);
  assert.ok(result.every((reel) => Number.isFinite(reel.score) && reel.score >= 0 && reel.score <= 100));
});

test('cold start ordena catálogo fixture con recencia, señal de exploración y variedad', () => {
  const result = rankCandidates([
    { id: 11, creador_id: 'a', genero: 'rock', created_at: '2026-10-22T12:00:00Z', visitas_calculadas: 100 },
    { id: 12, creador_id: 'a', genero: 'rock', created_at: '2026-10-22T11:00:00Z', visitas_calculadas: 0 },
    { id: 13, creador_id: 'b', genero: 'funk', created_at: '2026-10-21T12:00:00Z', visitas_calculadas: 0 },
  ], {}, { now });
  assert.deepEqual(result.map((reel) => reel.id), [12, 13, 11]);
  assert.equal(rankCandidates([], {}, { now }).length, 0);
});
