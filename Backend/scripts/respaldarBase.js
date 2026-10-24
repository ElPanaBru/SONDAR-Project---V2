const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
require('../database/conexion');

function main() {
  const faltantes = ['DB_HOST', 'DB_NAME', 'DB_USER'].filter(nombre => !process.env[nombre]);
  if (faltantes.length) { console.error('Falta configuracion en Backend/.env:', faltantes.join(', ')); process.exitCode = 1; return; }
  const carpeta = path.resolve(__dirname, '../backups');
  fs.mkdirSync(carpeta, { recursive: true });
  const archivo = path.join(carpeta, `sondar-${Date.now()}.dump`);
  const proceso = spawn(process.env.PG_DUMP_PATH || 'pg_dump', ['--format=custom', '--file', archivo], {
    shell: false, windowsHide: true, stdio: 'inherit',
    env: { ...process.env,
      PGHOST: process.env.DB_HOST,
      PGPORT: process.env.DB_PORT || '5432',
      PGDATABASE: process.env.DB_NAME,
      PGUSER: process.env.DB_USER,
      PGPASSWORD: process.env.DB_PASSWORD,
      PGSSLMODE: process.env.DB_SSL === 'false' ? 'disable' : 'require',
    },
  });
  proceso.on('error', error => { console.error('No se pudo iniciar pg_dump:', error.message); process.exitCode = 1; });
  proceso.on('close', code => {
    if (code !== 0) { process.exitCode = 1; return; }
    console.log('Respaldo PostgreSQL:', archivo);
    console.log('Los archivos de Storage y ajustes externos se respaldan por separado.');
  });
}
if (require.main === module) main();
module.exports = { main };
