const { crearCliente } = require('../database/conexion');
const { verificarContrato } = require('../database/verificarContrato');

async function main() {
  const client = crearCliente();
  try {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const resultado = await verificarContrato(client);
    await client.query('ROLLBACK');
    console.log(JSON.stringify(resultado, null, 2));
    if (!resultado.ok) process.exitCode = 1;
    return resultado;
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch(error => { console.error('Verificacion cancelada:', error.message); process.exitCode = 1; });
module.exports = { main };
