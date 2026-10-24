const { catalogo, equivalencias } = require('../../shared/generos.json');
const GENEROS_MUSICALES = catalogo.map(({ slug }) => slug);
function normalizarGeneroMusical(genero) {
  const valor = String(genero || '').trim().toLowerCase();
  return equivalencias[valor] || (GENEROS_MUSICALES.includes(valor) ? valor : '');
}
module.exports = { CATALOGO_GENEROS: catalogo, GENEROS_MUSICALES, normalizarGeneroMusical };
