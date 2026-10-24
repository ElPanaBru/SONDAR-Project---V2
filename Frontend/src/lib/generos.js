import catalogoGeneros from '../../../shared/generos.json';

export const GENEROS_MUSICALES = catalogoGeneros.catalogo.map(({ slug }) => slug);
