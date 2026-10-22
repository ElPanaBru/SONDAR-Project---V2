const fs = require('node:fs');
const path = require('node:path');
const { crearCliente } = require('../database/conexion');
const { leerSql, cuerpoTransaccional, MIGRACION_ACTUAL, tablasDelSnapshot } = require('../database/catalogoSql');
const { verificarContrato } = require('../database/verificarContrato');

async function actualizar(client, { dryRun = false, respaldar = () => {} } = {}) {
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    const tablas = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows
      .map(r => r.tablename).filter(t => tablasDelSnapshot().includes(t));
    const requeridas = ['users', 'generos', 'eventos', 'reels', 'comunidades', 'user_interests', 'reel_saves'];
    const faltantes = requeridas.filter(t => !tablas.includes(t));
    if (faltantes.length) throw new Error('Faltan tablas de instalacion: ' + faltantes.join(', ') + '. Consultar docs/BASE_DE_DATOS.md.');
    const q = t => 'public."' + t.replaceAll('"', '""') + '"';
    await client.query('LOCK TABLE ' + tablas.map(q).join(', ') + ' IN SHARE ROW EXCLUSIVE MODE');
    const respaldo = {};
    for (const tabla of tablas) respaldo[tabla] = (await client.query('SELECT * FROM ' + q(tabla))).rows;
    respaldo.restricciones = (await client.query("SELECT conrelid::regclass::text AS tabla, conname, pg_get_constraintdef(oid) AS definicion FROM pg_constraint WHERE connamespace = 'public'::regnamespace")).rows;
    respaldo.politicas = (await client.query("SELECT * FROM pg_policies WHERE schemaname = 'public'")).rows;
    await respaldar(respaldo);
    await client.query(cuerpoTransaccional(leerSql(MIGRACION_ACTUAL)));
    const resultado = await verificarContrato(client);
    if (!resultado.ok) throw new Error('El contrato final no coincide: ' + JSON.stringify(resultado));
    // Excepcion autorizada: retirar contenido de Metal, incluso si es genero secundario.
    const ids = (tabla, campo, valor) => new Set((respaldo[tabla] || []).filter(r => r[campo] === valor).map(r => String(r.id)));
    const eventosMetal = ids('eventos', 'genero', 'metal');
    const reelsMetal = ids('reels', 'genero', 'metal');
    for (const r of respaldo.evento_generos || []) if (r.genero === 'metal') eventosMetal.add(String(r.event_id));
    for (const r of respaldo.reel_generos || []) if (r.genero === 'metal') reelsMetal.add(String(r.reel_id));
    const comunidadesMetal = ids('comunidades', 'genero', 'metal');
    const postsMetal = new Set((respaldo.perfil_comunidad_publicaciones || []).filter(r => eventosMetal.has(String(r.evento_id)) || reelsMetal.has(String(r.reel_id))).map(r => String(r.id)));
    const publicacionesMetal = new Set((respaldo.comunidad_publicaciones || []).filter(r => comunidadesMetal.has(String(r.comunidad_id)) || eventosMetal.has(String(r.evento_asociado_id)) || reelsMetal.has(String(r.reel_asociado_id))).map(r => String(r.id)));
    const retirado = (tabla, r) => ({
      eventos: () => eventosMetal.has(String(r.id)),
      reels: () => reelsMetal.has(String(r.id)),
      perfil_comunidad_publicaciones: () => postsMetal.has(String(r.id)),
      perfil_comunidad_respuestas: () => postsMetal.has(String(r.publicacion_id)),
      comunidad_publicaciones: () => publicacionesMetal.has(String(r.id)),
      comunidad_comentarios: () => publicacionesMetal.has(String(r.publicacion_id)),
      reel_saves: () => reelsMetal.has(String(r.reel_id)),
      event_saves: () => eventosMetal.has(String(r.event_id)),
    }[tabla]?.() || false);
    // El catalogo y sus relaciones pueden fusionarse; las entidades de usuario se conservan.
    for (const tabla of ['users', 'eventos', 'reels', 'messages', 'perfil_comunidad_publicaciones', 'perfil_comunidad_respuestas', 'comunidad_publicaciones', 'comunidad_comentarios', 'reel_saves', 'event_saves']) {
      if (!respaldo[tabla]) continue;
      const despues = (await client.query('SELECT * FROM ' + q(tabla))).rows;
      // Solo genero puede normalizarse en eventos y reels; los demas datos deben ser identicos.
      const claves = [...new Set(respaldo[tabla].flatMap(Object.keys))].filter(k => !(['eventos', 'reels'].includes(tabla) && k === 'genero')).sort();
      const limpiar = r => JSON.stringify(claves.map(k => r[k]));
      if (JSON.stringify(respaldo[tabla].filter(r => !retirado(tabla, r)).map(limpiar).sort()) !== JSON.stringify(despues.map(limpiar).sort())) {
        throw new Error('Cambio inesperado de contenido en ' + tabla);
      }
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return resultado;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== '--dry-run')) throw new Error('Uso: db:actualizar [-- --dry-run]');
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) throw new Error('db:actualizar utiliza solo una base LOCAL. Para otros entornos revisar y aplicar la migracion canonica explicitamente.');
  const client = crearCliente();
  try {
    await client.connect();
    const resultado = await actualizar(client, {
      dryRun: process.argv.includes('--dry-run'),
      respaldar(respaldo) {
        const carpeta = path.resolve(__dirname, '../backups');
        fs.mkdirSync(carpeta, { recursive: true });
        const archivo = path.join(carpeta, 'antes-actualizacion-' + Date.now() + '.json');
        fs.writeFileSync(archivo, JSON.stringify(respaldo, null, 2), { mode: 0o600 });
        console.log('Respaldo de tablas public:', archivo);
      },
    });
    console.log(process.argv.includes('--dry-run') ? 'Ensayo correcto; cambios revertidos.' : 'Base actualizada.');
    console.log(JSON.stringify(resultado, null, 2));
  } finally { await client.end(); }
}
if (require.main === module) main().catch(error => { console.error('Actualizacion cancelada:', error.message); process.exitCode = 1; });
module.exports = { actualizar, main };
