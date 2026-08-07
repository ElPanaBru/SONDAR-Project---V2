const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const EXPECTED_TABLES = [
  'comunidad_comentario_likes',
  'comunidad_comentarios',
  'comunidad_miembros',
  'comunidad_publicacion_guardados',
  'comunidad_publicacion_likes',
  'comunidad_publicaciones',
  'comunidades',
  'content_reports',
  'event_organizers',
  'event_saves',
  'eventos',
  'follows',
  'notification_mutes',
  'notifications',
  'reel_comment_likes',
  'reel_comments',
  'reel_likes',
  'reel_saves',
  'reel_shares',
  'reel_views',
  'reels',
  'user_blocks',
  'user_interests',
  'user_settings',
  'users',
];

const REMOVED_COLUMNS = {
  users: [
    'full_name', 'artist_name', 'artist_bio', 'banner_url', 'instagram_url',
    'verified', 'profile_picture_url', 'profile_picture_status', 'telefono',
  ],
  reels: ['likes', 'compartidos', 'guardados', 'visitas', 'status', 'external_url'],
  reel_comments: ['likes', 'updated_at'],
  comunidad_publicaciones: ['likes', 'guardados', 'status', 'updated_at'],
  comunidad_comentarios: ['likes', 'status', 'updated_at'],
  eventos: ['status', 'updated_at'],
  notifications: ['entity_type', 'entity_id', 'metadata'],
};

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function crearCliente() {
  return new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 5432),
    ssl: { rejectUnauthorized: false },
  });
}

async function obtenerTablas(client) {
  const result = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return result.rows.map((row) => row.tablename);
}

async function obtenerColumnas(client) {
  const result = await client.query(`
    SELECT table_name, column_name, ordinal_position, data_type, udt_name,
           is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  return result.rows;
}

async function crearRespaldo(client, tables) {
  const backup = {
    generatedAt: new Date().toISOString(),
    schema: 'public',
    columns: await obtenerColumnas(client),
    constraints: (await client.query(`
      SELECT c.conname, c.contype, c.conrelid::regclass::text AS table_name,
             pg_get_constraintdef(c.oid, true) AS definition
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
      ORDER BY table_name, c.conname
    `)).rows,
    indexes: (await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `)).rows,
    policies: (await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `)).rows,
    data: {},
  };

  for (const table of tables) {
    const result = await client.query(`SELECT * FROM public.${quoteIdentifier(table)}`);
    backup.data[table] = result.rows;
  }

  const backupDirectory = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `db-before-minimal-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  return { backupPath, counts: Object.fromEntries(tables.map((table) => [table, backup.data[table].length])) };
}

async function auditar(client) {
  const tables = await obtenerTablas(client);
  const columns = await obtenerColumnas(client);
  const columnSet = new Set(columns.map((column) => `${column.table_name}.${column.column_name}`));
  const missingTables = EXPECTED_TABLES.filter((table) => !tables.includes(table));
  const extraTables = tables.filter((table) => !EXPECTED_TABLES.includes(table));
  const stillPresentColumns = Object.entries(REMOVED_COLUMNS).flatMap(([table, names]) =>
    names.filter((name) => columnSet.has(`${table}.${name}`)).map((name) => `${table}.${name}`)
  );
  const authResult = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM auth.users) AS auth_users,
      (SELECT COUNT(*)::int FROM public.users) AS public_users,
      (SELECT COUNT(*)::int
       FROM auth.users a
       LEFT JOIN public.users u ON u.id = a.id
       WHERE u.id IS NULL) AS auth_without_profile
  `);
  const rlsResult = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname = ANY($1::text[])
    ORDER BY c.relname
  `, [EXPECTED_TABLES]);
  const triggerResult = await client.query(`
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
      AND tgname IN ('on_auth_user_created', 'on_auth_user_email_updated')
    ORDER BY tgname
  `);
  const authFkResult = await client.query(`
    SELECT COUNT(*)::int AS total
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
  `);

  return {
    tables,
    missingTables,
    extraTables,
    stillPresentColumns,
    users: authResult.rows[0],
    rlsDisabled: rlsResult.rows.filter((row) => !row.enabled).map((row) => row.table_name),
    authTriggers: triggerResult.rows.map((row) => row.tgname),
    authForeignKeys: authFkResult.rows[0].total,
  };
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const securityOnly = process.argv.includes('--security');
  const onboardingOnly = process.argv.includes('--onboarding');
  const cleanupCountersOnly = process.argv.includes('--cleanup-counters');
  const client = crearCliente();
  await client.connect();

  try {
    if (checkOnly) {
      const audit = await auditar(client);
      console.log(JSON.stringify(audit, null, 2));
      return;
    }

    if (securityOnly) {
      const securityPath = path.join(__dirname, '..', 'BDD-Sql', 'Asegurar_RLS_Esquema_Minimo.sql');
      await client.query(fs.readFileSync(securityPath, 'utf8'));
      const audit = await auditar(client);
      if (audit.rlsDisabled.length) {
        throw new Error(`RLS sigue desactivado en: ${audit.rlsDisabled.join(', ')}`);
      }
      console.log(JSON.stringify({ ok: true, audit }, null, 2));
      return;
    }

    if (onboardingOnly) {
      const onboardingPath = path.join(__dirname, '..', 'BDD-Sql', 'Agregar_Onboarding_Perfil.sql');
      await client.query(fs.readFileSync(onboardingPath, 'utf8'));
      const result = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE table_name = 'users' AND column_name = 'birth_date')::int AS birth_date,
          COUNT(*) FILTER (WHERE table_name = 'user_interests' AND column_name = 'genre')::int AS interests
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND ((table_name = 'users' AND column_name = 'birth_date' AND data_type = 'date')
            OR (table_name = 'user_interests' AND column_name = 'genre'))
      `);
      if (result.rows[0].birth_date !== 1 || result.rows[0].interests !== 1) {
        throw new Error('No se completo el esquema de onboarding');
      }
      console.log(JSON.stringify({ ok: true, columns: ['public.users.birth_date', 'public.user_interests.genre'] }, null, 2));
      return;
    }

    if (cleanupCountersOnly) {
      const cleanupPath = path.join(__dirname, '..', 'BDD-Sql', 'Eliminar_Trigger_Compartidos_Legacy.sql');
      await client.query(fs.readFileSync(cleanupPath, 'utf8'));
      const result = await client.query(`
        SELECT COUNT(*)::int AS total
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'handle_reel_share_counter'
      `);
      if (result.rows[0].total !== 0) throw new Error('El trigger legacy sigue presente');
      console.log(JSON.stringify({ ok: true, removed: 'handle_reel_share_counter' }, null, 2));
      return;
    }

    const tablesBefore = await obtenerTablas(client);
    const { backupPath, counts } = await crearRespaldo(client, tablesBefore);
    console.log(`Respaldo creado: ${backupPath}`);

    const migrationPath = path.join(__dirname, '..', 'BDD-Sql', 'Migrar_A_Esquema_Minimo.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    try {
      await client.query(migrationSql);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => null);
      throw error;
    }

    const audit = await auditar(client);
    if (audit.missingTables.length || audit.extraTables.length || audit.stillPresentColumns.length) {
      throw new Error(`La auditoria final fallo: ${JSON.stringify(audit)}`);
    }

    for (const table of EXPECTED_TABLES) {
      const result = await client.query(`SELECT COUNT(*)::int AS total FROM public.${quoteIdentifier(table)}`);
      if (counts[table] !== undefined && result.rows[0].total !== counts[table]) {
        throw new Error(`Cambio inesperado de filas en ${table}: ${counts[table]} -> ${result.rows[0].total}`);
      }
    }

    console.log(JSON.stringify({ ok: true, backupPath, audit }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
