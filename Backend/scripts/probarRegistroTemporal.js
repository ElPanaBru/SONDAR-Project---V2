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
const email = `codex_flow_${suffix}@example.com`;
const username = `codex_flow_${suffix}`.slice(0, 30);
const password = 'CodexFix!2026';
let deletedByApi = false;

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

async function inspeccionarTemporal() {
  const userResult = await pool.query(`
    SELECT id, instance_id, aud, role, email,
           email_confirmed_at, confirmed_at,
           confirmation_token, recovery_token, email_change_token_new,
           email_change, email_change_token_current, reauthentication_token,
           phone, phone_change, phone_change_token,
           email_change_confirm_status, is_sso_user, is_anonymous,
           raw_app_meta_data, raw_user_meta_data,
           substring(encrypted_password FROM 1 FOR 7) AS pass_prefix,
           encrypted_password = crypt($2, encrypted_password) AS password_ok
    FROM auth.users
    WHERE email = $1
  `, [email, password]);

  const identityResult = await pool.query(`
    SELECT provider_id, user_id, provider, identity_data, email,
           last_sign_in_at, created_at, updated_at
    FROM auth.identities
    WHERE user_id = $1
  `, [userResult.rows[0]?.id || '00000000-0000-0000-0000-000000000000']);

  console.log('[auth.users temporal]');
  console.log(JSON.stringify(userResult.rows, null, 2));
  console.log('[auth.identities temporal]');
  console.log(JSON.stringify(identityResult.rows, null, 2));
}

async function cleanup() {
  const result = await pool.query(
    `DELETE FROM auth.users WHERE email LIKE $1 RETURNING email`,
    ['codex_flow_%@example.com']
  );
  console.log(`[cleanup] deleted=${result.rowCount}`);
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

    await inspeccionarTemporal();

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

    const loginData = JSON.parse(login.text);
    console.log(JSON.stringify({
      accessToken: Boolean(loginData.access_token),
      userId: loginData.user?.id || null,
    }));
    const token = loginData.access_token;
    started = Date.now();
    const me = await request('http://127.0.0.1:3000/api/usuarios/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[me] status=${me.response.status} ms=${Date.now() - started}`);
    console.log(me.text.slice(0, 300));
    if (me.response.status !== 200) process.exitCode = 1;

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
