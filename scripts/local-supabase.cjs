const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');

function run(args, capture = false) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root, encoding: 'utf8', windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

function writeEnv(relative, values) {
  const filename = path.join(root, relative);
  const content = '# Generado por npm run local:start. No versionar.\n'
    + Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  if (!fs.existsSync(filename) || fs.readFileSync(filename, 'utf8') !== content) {
    fs.writeFileSync(filename, content);
  }
}

function configure(status) {
  const db = new URL(status.DB_URL);
  const api = new URL(status.API_URL);
  if (!['127.0.0.1', 'localhost'].includes(db.hostname)
      || !['127.0.0.1', 'localhost'].includes(api.hostname)
      || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error('La CLI no devolvio una configuracion local completa.');
  }
  writeEnv('Backend/.env.local', {
    PORT: 3000, FRONTEND_URL: 'http://localhost:8081',
    DB_HOST: db.hostname, DB_PORT: db.port, DB_NAME: db.pathname.slice(1),
    DB_USER: decodeURIComponent(db.username), DB_PASSWORD: decodeURIComponent(db.password), DB_SSL: 'false',
    SUPABASE_URL: api.origin, SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    SUPABASE_EVENTOS_BUCKET: 'eventos', SUPABASE_PERFILES_BUCKET: 'perfiles', SUPABASE_REELS_BUCKET: 'reels',
    AUTO_MIGRATE_SETTINGS: 'false',
  });
  writeEnv('sondar-mobile/.env.local', {
    EXPO_PUBLIC_API_URL: '', EXPO_PUBLIC_SUPABASE_LOCAL: 'true',
    EXPO_PUBLIC_SUPABASE_URL: api.origin, EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  });
}

function main(command) {
  if (!fs.existsSync(cli)) throw new Error('Falta la CLI de Supabase. Ejecuta npm ci en la raiz.');
  if (command === 'stop') return run(['stop']);
  if (command === 'status') {
    const status = JSON.parse(run(['status', '--output', 'json'], true));
    console.log(`API Supabase: ${status.API_URL}\nPostgreSQL: ${new URL(status.DB_URL).host}\nStudio: ${status.STUDIO_URL}\nCorreo: ${status.MAILPIT_URL || status.INBUCKET_URL}`);
    return;
  }
  if (command !== 'start') throw new Error('Uso: node scripts/local-supabase.cjs start|stop|status');
  console.log('Preparando Supabase movil local (Docker)...');
  run(['start'], true);
  // Actualiza sin borrar filas. No ejecuta db reset ni opera contra un proyecto remoto.
  run(['migration', 'up', '--local']);
  const status = JSON.parse(run(['status', '--output', 'json'], true));
  configure(status);
  console.log(`Supabase movil local listo. Studio: ${status.STUDIO_URL}. Variables locales actualizadas.`);
}

if (require.main === module) {
  try { main(process.argv[2] || 'start'); }
  catch (error) {
    console.error('No se pudo preparar Supabase local. Comprueba que Docker Desktop este iniciado.');
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { configure };
