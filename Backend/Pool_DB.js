 const path = require('path');
 const { Pool } = require('pg');
 require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

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
     keepAlive: true,
     application_name: process.env.DB_APPLICATION_NAME || 'sondar-backend',
     ssl: process.env.DB_SSL === 'false' ? false : {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ...(process.env.DB_SSL_CA
          ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') }
          : {})
    }
 });

 pool.on('error', (err) => {
   console.error('Error inesperado en el pool de PostgreSQL:', err);
 });

 module.exports = pool;
