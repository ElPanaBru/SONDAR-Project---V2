const GENEROS_MUSICALES = Object.freeze([
  'pop',
  'rock',
  'edm',
  'jazz',
  'blues',
  'cumbia',
  'trap',
  'metal',
  'folklore',
  'otros',
]);

const GENEROS_MUSICALES_SET = new Set(GENEROS_MUSICALES);
const GENEROS_REEL_SET = new Set(GENEROS_MUSICALES);

function normalizarGenero(valor) {
  return String(valor || '').trim().toLowerCase();
}

function generoMusicalValido(valor) {
  return GENEROS_MUSICALES_SET.has(normalizarGenero(valor));
}

function generoReelValido(valor) {
  return GENEROS_REEL_SET.has(normalizarGenero(valor));
}

module.exports = {
  GENEROS_MUSICALES,
  GENEROS_MUSICALES_SET,
  GENEROS_REEL_SET,
  normalizarGenero,
  generoMusicalValido,
  generoReelValido,
};
