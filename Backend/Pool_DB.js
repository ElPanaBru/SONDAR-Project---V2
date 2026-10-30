 const path = require('path');
 const { Pool } = require('pg');
 require('dotenv').config({ path: path.join(__dirname, '.env') });

 const numeroEntorno = (nombre, fallback) => {
   const valor = Number(process.env[nombre]);
   return Number.isFinite(valor) && valor > 0 ? valor : fallback;
 };

 const pool = new Pool({
     user: process.env.DB_USER,
     host: process.env.DB_HOST,
     database: process.env.DB_NAME,
     password: process.env.DB_PASSWORD,
     port: process.env.DB_PORT,
     max: numeroEntorno('DB_POOL_MAX', 10),
     connectionTimeoutMillis: numeroEntorno('DB_CONNECTION_TIMEOUT_MS', 8000),
     idleTimeoutMillis: numeroEntorno('DB_IDLE_TIMEOUT_MS', 30000),
     query_timeout: numeroEntorno('DB_QUERY_TIMEOUT_MS', 12000),
     statement_timeout: numeroEntorno('DB_STATEMENT_TIMEOUT_MS', 12000),
     ssl: process.env.DB_SSL === 'false' ? false : {
        rejectUnauthorized: false
    }
 });

 pool.on('error', (err) => {
   console.error('Error inesperado en el pool de PostgreSQL:', err);
 });

 pool.connect((err, client, release) => {
   if (err) {
     return console.error('❌ Error adquiriendo el cliente de la DB:', err.stack);
   }
   console.log('✅ Conexión a PostgreSQL establecida con éxito');
   release();
 });

 module.exports = pool;
