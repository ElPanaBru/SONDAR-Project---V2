 const { Pool } = require('pg');
 require('./env');

 const pool = new Pool({
     user: process.env.DB_USER,
     host: process.env.DB_HOST,
     database: process.env.DB_NAME,
     password: process.env.DB_PASSWORD,
     port: process.env.DB_PORT,
     connectionTimeoutMillis: 8000,
     idleTimeoutMillis: 30000,
     ssl: process.env.DB_SSL === 'false' ? false : {
        rejectUnauthorized: false
    }
 });
 pool.connect((err, client, release) => {
   if (err) {
     return console.error('❌ Error adquiriendo el cliente de la DB:', err.stack);
   }
   console.log('✅ Conexión a PostgreSQL establecida con éxito');
   release();
 });

 pool.on('error', (error) => {
   console.error('Error en una conexion inactiva de PostgreSQL:', error.code || error.message);
 });

 module.exports = pool;
