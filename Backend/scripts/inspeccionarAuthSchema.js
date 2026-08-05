const path = require('path');
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
  await mostrar('columnas auth.users/auth.identities', `
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name IN ('users', 'identities')
    ORDER BY table_name, ordinal_position
  `);

  await mostrar('constraints auth.users/auth.identities', `
    SELECT c.conname, c.contype, c.conrelid::regclass::text AS table_name,
           pg_get_constraintdef(c.oid, true) AS def
    FROM pg_constraint c
    WHERE c.connamespace = 'auth'::regnamespace
      AND c.conrelid IN ('auth.users'::regclass, 'auth.identities'::regclass)
    ORDER BY table_name, c.conname
  `);

  await mostrar('usuarios ejemplo sin secretos', `
    SELECT id, instance_id, aud, role,
           email,
           email_confirmed_at, confirmed_at,
           confirmation_token, recovery_token, email_change_token_new,
           email_change, email_change_token_current, reauthentication_token,
           phone, phone_change, phone_change_token,
           email_change_confirm_status, is_sso_user, is_anonymous,
           raw_app_meta_data,
           substring(encrypted_password FROM 1 FOR 4) AS pass_prefix
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 3
  `);

  await mostrar('identities ejemplo', `
    SELECT provider, provider_id, user_id, identity_data, id
    FROM auth.identities
    ORDER BY created_at DESC
    LIMIT 3
  `);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
