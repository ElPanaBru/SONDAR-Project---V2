// Parámetros iniciales del prototipo; no proceden del recomendador heredado.
// Pesos relativos normalizados por su suma; las señales ausentes aportan cero.
const DEFAULT_CONFIG = Object.freeze({
  version: 'discover-pure-v1',
  weights: Object.freeze({ genre: 0.65, creator: 0.15, freshness: 0.10, discovery: 0.10 }),
  freshnessHalfLifeDays: 14,
  exposureScale: 100, // A 100 impresiones, el bono de descubrimiento se reduce a la mitad.
  diversity: Object.freeze({ windowSize: 3, genrePenalty: 12, creatorPenalty: 18 }),
});

/**
 * Combina parámetros parciales con defaults sin modificar ninguna entrada.
 * @param {object} [overrides] Pesos no negativos, semivida/escala positivas;
 * ventana entera 0..100 y penalizaciones en puntos 0..100. Ventana 0 las desactiva.
 * @returns {object} Configuración completa y congelada, incluyendo versión.
 * @throws {RangeError} Si los parámetros son no finitos o están fuera de rango.
 */
function createConfig(overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides,
    weights: { ...DEFAULT_CONFIG.weights, ...overrides?.weights },
    diversity: { ...DEFAULT_CONFIG.diversity, ...overrides?.diversity } };
  const weights = ['genre', 'creator', 'freshness', 'discovery'].map((key) => config.weights[key]);
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!weights.every((value) => Number.isFinite(value) && value >= 0)
      || !Number.isFinite(total) || total <= 0
      || !Number.isFinite(config.freshnessHalfLifeDays) || config.freshnessHalfLifeDays <= 0
      || !Number.isFinite(config.exposureScale) || config.exposureScale <= 0
      || !Number.isInteger(config.diversity.windowSize) || config.diversity.windowSize < 0 || config.diversity.windowSize > 100
      || !['genrePenalty', 'creatorPenalty'].every((key) => Number.isFinite(config.diversity[key]) && config.diversity[key] >= 0 && config.diversity[key] <= 100)
      || typeof config.version !== 'string' || !config.version.trim()) {
    throw new RangeError('Configuracion de ranking invalida.');
  }
  return Object.freeze({ ...config, weights: Object.freeze(config.weights), diversity: Object.freeze(config.diversity) });
}

module.exports = { DEFAULT_CONFIG, createConfig };
