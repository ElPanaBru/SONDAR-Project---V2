const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { Client } = require('pg');

function crearCliente() {
  const faltantes = ['DB_HOST', 'DB_NAME', 'DB_USER'].filter(nombre => !process.env[nombre]);
  if (faltantes.length) throw new Error('Falta configuracion en Backend/.env: ' + faltantes.join(', '));
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
}

module.exports = { crearCliente };
