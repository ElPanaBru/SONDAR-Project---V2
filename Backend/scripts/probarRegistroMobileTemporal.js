const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });
dotenv.config({ path: path.join(__dirname, '..', '..', 'sondar-mobile', '.env.local'), quiet: true });

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

const apiUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const suffix = Date.now().toString(36);
const email = `codex_mobile_${suffix}@example.com`;
const username = `codex_mobile_${suffix}`.slice(0, 30);
const password = 'CodexFix!2026';

async function request(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text, ms: Date.now() - started };
}

async function cleanup() {
  await pool.query('DELETE FROM users WHERE email = $1', [email]).catch(() => null);
  await pool.query('DELETE FROM auth.users WHERE email = $1', [email]).catch(() => null);
}

async function main() {
  try {
    const created = await request(`${apiUrl}/api/usuarios/crear-cuenta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, user_type: 'musico' }),
    });
    console.log(`[create] status=${created.response.status} ms=${created.ms}`);
    console.log(created.text.slice(0, 300));
    if (created.response.status !== 201) {
      process.exitCode = 1;
      return;
    }

    const login = await request(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    console.log(`[login] status=${login.response.status} ms=${login.ms}`);
    if (login.response.status !== 200) {
      console.log(login.text.slice(0, 500));
      process.exitCode = 1;
      return;
    }

    const token = JSON.parse(login.text).access_token;
    const me = await request(`${apiUrl}/api/usuarios/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[me] status=${me.response.status} ms=${me.ms}`);
    console.log(me.text.slice(0, 300));
    if (me.response.status !== 200) process.exitCode = 1;

    const onboardingForm = new FormData();
    onboardingForm.append('nombre', 'Codex Mobile');
    onboardingForm.append('bio', 'Perfil temporal para probar onboarding mobile.');
    onboardingForm.append('birthDate', '2000-01-01');
    onboardingForm.append('genres', JSON.stringify(['alternativo', 'punk', 'reggae']));
    onboardingForm.append(
      'avatar',
      new Blob([
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=',
          'base64'
        ),
      ], { type: 'image/png' }),
      'avatar.png'
    );

    const onboarding = await request(`${apiUrl}/api/usuarios/me/onboarding`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: onboardingForm,
    });
    console.log(`[onboarding] status=${onboarding.response.status} ms=${onboarding.ms}`);
    console.log(onboarding.text.slice(0, 300));
    if (onboarding.response.status !== 200) {
      process.exitCode = 1;
      return;
    }

    const reels = await request(`${apiUrl}/api/reels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[reels] status=${reels.response.status} ms=${reels.ms}`);
    if (reels.response.status !== 200) {
      console.log(reels.text.slice(0, 300));
      process.exitCode = 1;
      return;
    }

    const deleted = await request(`${apiUrl}/api/usuarios/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`[delete] status=${deleted.response.status} ms=${deleted.ms}`);
    console.log(deleted.text.slice(0, 300));
    if (deleted.response.status !== 200) process.exitCode = 1;
  } finally {
    await cleanup();
    await pool.end();
  }
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
  await cleanup().catch(() => null);
  await pool.end().catch(() => null);
});
