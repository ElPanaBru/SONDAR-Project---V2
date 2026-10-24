const { createConfig } = require('./config');
const { normalizeGenres } = require('./scoring');

function overlap(a, b) {
  const other = new Map(b);
  return a.reduce((sum, [genre, weight]) => sum + Math.min(weight, other.get(genre) || 0), 0);
}

/**
 * Utilidad greedy = score - penalización media en ventana anterior. Coincidencia
 * multigénero = suma de mínimos de pesos normalizados compartidos. O(n² * ventana
 * * géneros), para pools acotados. No calcula afinidades ni modifica objetos.
 * @param {Array<{id:string|number,score:number,genres?:Array<string|{genre:string,weight?:number}>,creatorId?:string|number}>} previews
 * Elementos válidos: ID no vacío (o entero seguro >= 0), score finito [0,100].
 * Inválidos se omiten. IDs únicos después de convertir a string.
 * @param {object} [config] Configuración parcial según createConfig.
 * @returns {Array<object>} Array nuevo con las mismas referencias válidas.
 * Empate por utilidad, luego score descendente e ID textual por código Unicode.
 * Sin exclusiones duras: conserva todos los válidos aun sin variedad.
 * @throws {TypeError} Si previews no es array.
 * @throws {RangeError} Si hay IDs válidos duplicados.
 */
function diversifyPreviews(previews, config) {
  if (!Array.isArray(previews)) throw new TypeError('Se espera un array de previews.');
  const { diversity } = createConfig(config);
  const ids = new Set();
  const pending = [];
  for (const preview of previews) {
    const id = preview?.id;
    if (!preview || typeof preview !== 'object' || Array.isArray(preview)
        || !(typeof id === 'string' && id.trim() || Number.isSafeInteger(id) && id >= 0)
        || !Number.isFinite(preview.score) || preview.score < 0 || preview.score > 100) continue;
    const key = String(id);
    if (ids.has(key)) throw new RangeError('IDs de previews duplicados.');
    ids.add(key);
    const creator = preview.creatorId;
    pending.push({ preview, id: key, genres: normalizeGenres(preview.genres),
      creator: typeof creator === 'string' && creator.trim() || Number.isSafeInteger(creator) && creator >= 0
        ? String(creator) : null });
  }
  const selected = [];
  while (pending.length) {
    const recent = diversity.windowSize ? selected.slice(-diversity.windowSize) : [];
    const utility = (candidate) => candidate.preview.score - recent.reduce((sum, previous) => sum
      + diversity.genrePenalty * overlap(candidate.genres, previous.genres)
      + (candidate.creator !== null && candidate.creator === previous.creator ? diversity.creatorPenalty : 0), 0)
      / (recent.length || 1);
    let best = 0;
    let bestUtility = utility(pending[0]);
    for (let i = 1; i < pending.length; i += 1) {
      const value = utility(pending[i]);
      const candidate = pending[i];
      const current = pending[best];
      if (value > bestUtility || value === bestUtility && (candidate.preview.score > current.preview.score
          || candidate.preview.score === current.preview.score && candidate.id < current.id)) {
        best = i;
        bestUtility = value;
      }
    }
    selected.push(pending.splice(best, 1)[0]);
  }
  return selected.map(({ preview }) => preview);
}

module.exports = { diversifyPreviews };
