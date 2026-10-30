const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
  query_timeout: 12000,
  statement_timeout: 12000,
});

async function mostrar(nombre, sql) {
  const result = await pool.query(sql);
  console.log(`\n[${nombre}]`);
  console.log(JSON.stringify(result.rows, null, 2));
}

async function main() {
  if (process.argv.includes('--disable-profile-trigger')) {
    const migrationPath = path.join(__dirname, '..', 'BDD-Sql', 'Desactivar_Trigger_Auth_Perfil.sql');
    await pool.query(fs.readFileSync(migrationPath, 'utf8'));
    console.log(JSON.stringify({ ok: true, applied: path.basename(migrationPath) }, null, 2));
  }

  await mostrar('auth.users triggers', `
    SELECT tgname, tgenabled, p.proname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'auth.users'::regclass
      AND NOT t.tgisinternal
    ORDER BY tgname
  `);

  await mostrar('funciones auth/public relevantes', `
    SELECT n.nspname AS schema, p.proname, left(pg_get_functiondef(p.oid), 1200) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname IN ('handle_new_auth_user', 'sync_auth_user_email', 'handle_new_user')
    ORDER BY n.nspname, p.proname
  `);

  await mostrar('actividad no idle', `
    SELECT pid, state, wait_event_type, wait_event,
           now() - query_start AS age,
           left(query, 240) AS query
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state <> 'idle'
    ORDER BY query_start
  `);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
