 const path = require('path');
 const { Pool } = require('pg');
 require('dotenv').config({ path: path.join(__dirname, '.env') });

 const pool = new Pool({
     user: process.env.DB_USER,
     host: process.env.DB_HOST,
     database: process.env.DB_NAME,
     password: process.env.DB_PASSWORD,
     port: process.env.DB_PORT,
     ssl: {
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

 module.exports = pool;
