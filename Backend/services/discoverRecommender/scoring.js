const { createConfig } = require('./config');

const unit = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

// Los slugs válidos se verifican en el adaptador futuro. No añadimos dependencias
// del catálogo ni del transporte. Duplicados conservan el mayor peso, no suman.
function normalizeGenres(genres) {
  const weights = new Map();
  for (const item of Array.isArray(genres) ? genres : []) {
    const genre = typeof item === 'string' ? item : item?.genre;
    const weight = typeof item === 'string' ? 1 : item?.weight ?? 1;
    if (typeof genre !== 'string' || !genre.trim() || !Number.isFinite(weight) || weight <= 0) continue;
    const key = genre.trim().toLowerCase();
    weights.set(key, Math.max(weights.get(key) || 0, weight));
  }
  const entries = [...weights].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const max = entries.reduce((value, [, weight]) => Math.max(value, weight), 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight / max, 0);
  return entries.map(([genre, weight]) => [genre, (weight / max) / total]);
}

/**
 * Puntúa sin reloj, I/O ni variables de entorno. Datos suministrados por llamador.
 * @param {object} [profile] Perfil depurado/decaído, no puntajes SQL heredados.
 * @param {Object<string, number>} [profile.genreAffinities] Slugs canónicos y valores [0,1].
 * @param {Object<string, {affinity:number,reliable:boolean}>} [profile.creatorAffinities]
 * Solo se usa afinidad por cuenta creadora con reliable === true.
 * @param {object} [preview]
 * @param {Array<string|{genre:string,weight?:number}>} [preview.genres] Pesos positivos
 * normalizados (iguales por defecto); etiquetas duplicadas no aumentan contribución.
 * @param {string|number} [preview.creatorId]
 * @param {number} [preview.ageDays] Edad >= 0 contra fecha de referencia fija.
 * @param {number} [preview.exposureCount] Impresiones >= 0 en ventana común fiable.
 * @param {object} [config] Configuración parcial según createConfig.
 * @returns {number} Score finito [0,100]. Señales ausentes/no finitas aportan cero;
 * afinidades se acotan a [0,1]; edad/exposición negativas se consideran desconocidas.
 */
function scorePreview(profile = {}, preview = {}, config) {
  const settings = createConfig(config);
  const genre = normalizeGenres(preview?.genres).reduce((sum, [key, weight]) => {
    const affinities = profile?.genreAffinities;
    return sum + weight * unit(affinities && Object.hasOwn(affinities, key) ? affinities[key] : 0);
  }, 0);
  const creatorId = preview?.creatorId;
  const validCreator = typeof creatorId === 'string' && creatorId.trim()
    || Number.isSafeInteger(creatorId) && creatorId >= 0;
  const creators = profile?.creatorAffinities;
  const creatorSignal = validCreator && creators && Object.hasOwn(creators, creatorId) ? creators[creatorId] : null;
  const creator = creatorSignal?.reliable === true ? unit(creatorSignal.affinity) : 0;
  const freshness = Number.isFinite(preview?.ageDays) && preview.ageDays >= 0
    ? 2 ** (-preview.ageDays / settings.freshnessHalfLifeDays) : 0;
  const discovery = Number.isFinite(preview?.exposureCount) && preview.exposureCount >= 0
    ? 1 / (1 + preview.exposureCount / settings.exposureScale) : 0;
  const components = { genre, creator, freshness, discovery };
  const keys = Object.keys(components);
  const totalWeight = keys.reduce((sum, key) => sum + settings.weights[key], 0);
  return 100 * unit(keys.reduce((sum, key) => sum + components[key] * (settings.weights[key] / totalWeight), 0));
}

module.exports = { scorePreview, normalizeGenres };
