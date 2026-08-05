const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Frontend', '.env') });

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

const suffix = Date.now().toString(36);
const email = `codex_diag_${suffix}@example.com`;
const username = `codex_diag_${suffix}`.slice(0, 30);
const password = 'CodexDiag!2026';

async function consultarActividad(label) {
  const result = await pool.query(`
    SELECT pid, usename, state, wait_event_type, wait_event,
           now() - query_start AS age,
           left(query, 300) AS query
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state <> 'idle'
    ORDER BY query_start
  `);
  console.log(`\n[${label}]`);
  console.log(JSON.stringify(result.rows, null, 2));
}

async function limpiar() {
  const result = await pool.query(
    `DELETE FROM auth.users WHERE email = $1 RETURNING id`,
    [email]
  );
  console.log(`\n[cleanup] deleted=${result.rowCount}`);
}

async function main() {
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const started = Date.now();

  const signupPromise = fetch(`${process.env.VITE_SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      data: { username, user_type: 'musico' },
    }),
    signal: controller.signal,
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));
  await consultarActividad('actividad a los 3s');

  try {
    const response = await signupPromise;
    const text = await response.text();
    console.log(`\n[signup] status=${response.status} ms=${Date.now() - started}`);
    console.log(text.slice(0, 500));
  } catch (error) {
    console.log(`\n[signup] fail ms=${Date.now() - started} ${error.name}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
    await consultarActividad('actividad final');
    await limpiar().catch((error) => {
      console.error(`[cleanup] fail ${error.code || ''} ${error.message}`);
    });
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
