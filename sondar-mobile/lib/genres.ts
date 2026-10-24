import genreCatalog from '../../shared/generos.json';

export const musicGenres = genreCatalog.catalogo.map(({ slug }) => slug);
export const genres = ['todos', ...musicGenres];
const validGenres = new Set(musicGenres);
const aliases: Record<string, string> = genreCatalog.equivalencias;

export function normalizeGenres(value: unknown): string[] {
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap(item => String(item || '').toLowerCase().split(/\s*(?:\/|,|\|)\s*/));
  return [...new Set(parts.map(part => aliases[part.trim()] || part.trim()).filter(part => validGenres.has(part)))];
}
