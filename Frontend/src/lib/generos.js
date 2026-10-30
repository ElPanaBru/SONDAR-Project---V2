import datos from '../../../shared/generos.json';
export const CATALOGO_GENEROS = datos.catalogo;
export const GENEROS_MUSICALES = CATALOGO_GENEROS.map(({ slug }) => slug);
export const ETIQUETAS_GENEROS = Object.fromEntries(CATALOGO_GENEROS.map(({ slug, nombre }) => [slug, nombre]));
export function normalizarGeneroMusical(genero) {
  const valor = String(genero || '').trim().toLowerCase();
  return datos.equivalencias[valor] || (GENEROS_MUSICALES.includes(valor) ? valor : '');
}
export function nombreGeneroMusical(genero) {
  return ETIQUETAS_GENEROS[normalizarGeneroMusical(genero)] || 'Sin genero';
}
