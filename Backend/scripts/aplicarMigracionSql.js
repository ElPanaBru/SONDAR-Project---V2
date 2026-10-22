const { crearCliente } = require('../database/conexion');
const { resolverSql, leerSql, cuerpoTransaccional, listarMigraciones, listarMantenimiento, ALIASES } = require('../database/catalogoSql');

async function main() {
  const argumentos = process.argv.slice(2);
  if (argumentos.length === 1 && argumentos[0] === '--list') {
    console.log(JSON.stringify({ migraciones: listarMigraciones(), mantenimiento: listarMantenimiento(), aliases: ALIASES }, null, 2));
    return;
  }
  if (argumentos.slice(1).some(arg => arg !== '--dry-run')) throw new Error('Uso: db:aplicar -- Nombre.sql [--dry-run]');
  const nombre = process.argv[2];
  const archivo = resolverSql(nombre); // Validar antes de abrir cualquier conexion.
  const client = crearCliente();
  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(cuerpoTransaccional(leerSql(nombre)));
    await client.query(process.argv.includes('--dry-run') ? 'ROLLBACK' : 'COMMIT');
    console.log(process.argv.includes('--dry-run') ? 'Ensayo revertido:' : 'SQL aplicado manualmente:', archivo);
    console.log('Este comando no registra versiones en el historial de la CLI de Supabase.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await client.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main };
