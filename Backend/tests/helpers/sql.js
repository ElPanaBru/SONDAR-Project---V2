const { leerSql, MIGRACION_ACTUAL, listarMigraciones } = require('../../database/catalogoSql');
function sql(nombre = 'snapshot') {
  const archivo = nombre === 'snapshot' ? listarMigraciones()[0] : nombre === 'actual' ? MIGRACION_ACTUAL : nombre;
  return leerSql(archivo).replace(/"([a-z0-9_]+)"/g, '$1');
}
module.exports = { sql };
