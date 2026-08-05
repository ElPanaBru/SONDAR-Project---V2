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
const email = `codex_onboard_${suffix}@example.com`;
const username = `codex_onboard_${suffix}`.slice(0, 30);
const password = 'CodexFix!2026';
let deletedByApi = false;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

async function cleanup() {
  const users = await pool.query(
    'DELETE FROM users WHERE email LIKE $1 RETURNING email',
    ['codex_onboard_%@example.com']
  );
  const authUsers = await pool.query(
    'DELETE FROM auth.users WHERE email LIKE $1 RETURNING email',
    ['codex_onboard_%@example.com']
  );
  console.log(`[cleanup] users=${users.rowCount} auth=${authUsers.rowCount}`);
}

async function main() {
  try {
    let started = Date.now();
    const created = await request('http://127.0.0.1:3000/api/usuarios/crear-cuenta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, user_type: 'musico' }),
    });
    console.log(`[create] status=${created.response.status} ms=${Date.now() - started}`);
    console.log(created.text.slice(0, 300));
    if (created.response.status !== 201) {
      process.exitCode = 1;
      return;
    }

    started = Date.now();
    const login = await request(`${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    console.log(`[login] status=${login.response.status} ms=${Date.now() - started}`);
    if (login.response.status !== 200) {
      console.log(login.text.slice(0, 500));
      process.exitCode = 1;
      return;
    }

    const token = JSON.parse(login.text).access_token;
    const avatarBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    );
    const formData = new FormData();
    formData.append('nombre', 'Codex Onboarding');
    formData.append('bio', 'Prueba temporal de onboarding.');
    formData.append('birthDate', '2013-08-01');
    formData.append('genres', JSON.stringify(['trap', 'cumbia', 'edm']));
    formData.append('avatar', new Blob([avatarBytes], { type: 'image/png' }), 'avatar.png');

    started = Date.now();
    const onboarding = await request('http://127.0.0.1:3000/api/usuarios/me/onboarding', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    console.log(`[onboarding] status=${onboarding.response.status} ms=${Date.now() - started}`);
    console.log(onboarding.text.slice(0, 500));
    if (onboarding.response.status !== 200) {
      process.exitCode = 1;
      return;
    }

    started = Date.now();
    const deleted = await request('http://127.0.0.1:3000/api/usuarios/me', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    console.log(`[delete] status=${deleted.response.status} ms=${Date.now() - started}`);
    console.log(deleted.text.slice(0, 300));
    deletedByApi = deleted.response.status === 200;
    if (!deletedByApi) process.exitCode = 1;
  } finally {
    if (!deletedByApi) {
      await cleanup().catch((error) => {
        console.error(`[cleanup] fail ${error.code || ''} ${error.message}`);
      });
    } else {
      console.log('[cleanup] skipped after API delete');
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
