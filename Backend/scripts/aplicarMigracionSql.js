const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const archivo = process.argv[2];

if (!archivo || archivo.includes('..') || path.isAbsolute(archivo)) {
  console.error('Uso: node Backend/scripts/aplicarMigracionSql.js Nombre_De_Migracion.sql');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'BDD-Sql', archivo);

if (!fs.existsSync(migrationPath)) {
  console.error(`No existe la migracion: ${migrationPath}`);
  process.exit(1);
}

const client = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  await client.query(fs.readFileSync(migrationPath, 'utf8'));
  console.log(`Migracion aplicada: ${archivo}`);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => null);
  });
