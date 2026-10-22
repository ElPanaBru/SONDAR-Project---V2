const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '../..');
const directorioMigraciones = path.join(raiz, 'supabase/migrations');
const MIGRACION_ACTUAL = '20261022120000_alinear_catalogo_y_contrato.sql';
const ALIASES = Object.freeze({
  'Unificar_Generos_Definitivos.sql': '20261015182000_generos_definitivos.sql',
  'Retirar_Reggae.sql': '20261015190000_retirar_reggae.sql',
  'Permitir_Respuestas_Sin_Seguir.sql': '20261016090000_respuestas_sin_seguir.sql',
});

function listarMigraciones() {
  return fs.readdirSync(directorioMigraciones).filter(n => /^\d{14}_[a-z0-9_]+\.sql$/.test(n)).sort();
}

function listarMantenimiento() {
  return fs.readdirSync(path.join(raiz, 'Backend/BDD-Sql')).filter(n => /^[a-zA-Z0-9_]+\.sql$/.test(n)).sort();
}

function resolverSql(nombre) {
  if (!nombre || path.basename(nombre) !== nombre || !/^[a-zA-Z0-9_]+\.sql$/.test(nombre)) {
    throw new Error('Indicar solo el nombre de una migracion o un SQL de mantenimiento.');
  }
  const canonico = ALIASES[nombre] || nombre;
  if (listarMigraciones().includes(canonico)) return path.join(directorioMigraciones, canonico);
  const mantenimiento = path.join(raiz, 'Backend/BDD-Sql', canonico);
  if (fs.existsSync(mantenimiento)) return mantenimiento;
  throw new Error(`SQL retirado o desconocido: ${nombre}. Consultar docs/BASE_DE_DATOS.md.`);
}

function leerSql(nombre) {
  return fs.readFileSync(resolverSql(nombre), 'utf8');
}

// Solo los marcadores externos: nunca se quitan los BEGIN/END de PL/pgSQL.
function cuerpoTransaccional(sql) {
  return sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
}

function tablasDelSnapshot() {
  const sql = leerSql(listarMigraciones()[0]);
  return [...sql.matchAll(/CREATE TABLE "public"\."([a-z0-9_]+)"/g)].map(m => m[1]).sort();
}

module.exports = { ALIASES, MIGRACION_ACTUAL, listarMigraciones, listarMantenimiento, resolverSql, leerSql, cuerpoTransaccional, tablasDelSnapshot };
