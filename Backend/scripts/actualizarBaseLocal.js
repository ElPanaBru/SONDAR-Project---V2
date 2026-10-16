const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pool = require('../Pool_DB');
const { GENEROS_MUSICALES } = require('../services/generos');
const tablas = ['generos', 'comunidades', 'eventos', 'reels', 'evento_generos', 'reel_generos', 'user_interests', 'user_genre_affinity', 'user_genre_preferences', 'comunidad_publicaciones', 'comunidad_miembros'];

async function ejecutar() {
  let client;
  try {
    if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)) {
      throw new Error('Este comando es para la base LOCAL. Revisa DB_HOST en Backend/.env.');
    }
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('LOCK TABLE ' + tablas.map(t => 'public.' + t).join(', ') + ' IN SHARE ROW EXCLUSIVE MODE');
    const respaldo = {};
    for (const tabla of tablas) respaldo[tabla] = (await client.query('SELECT * FROM public.' + tabla)).rows;
    respaldo.restricciones = (await client.query("SELECT conrelid::regclass::text AS tabla, conname, pg_get_constraintdef(oid) AS definicion FROM pg_constraint WHERE connamespace = 'public'::regnamespace")).rows;
    respaldo.politicas = (await client.query("SELECT * FROM pg_policies WHERE schemaname = 'public'")).rows;
    const archivo = path.join(os.tmpdir(), 'sondar-base-local-' + Date.now() + '.json');
    fs.writeFileSync(archivo, JSON.stringify(respaldo, null, 2));
    console.log('Respaldo:', archivo);
    for (const nombre of ['Unificar_Generos_Definitivos.sql', 'Retirar_Reggae.sql', 'Permitir_Respuestas_Sin_Seguir.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '../BDD-Sql', nombre), 'utf8')
        .replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
      await client.query(sql);
    }
    const generos = (await client.query('SELECT slug FROM public.generos ORDER BY orden')).rows.map(r => r.slug);
    if (JSON.stringify(generos) !== JSON.stringify(GENEROS_MUSICALES)) throw new Error('Catalogo final inesperado.');
    for (const tabla of ['eventos', 'reels', 'comunidad_publicaciones']) {
      const ids = (await client.query('SELECT id FROM public.' + tabla)).rows.map(r => String(r.id)).sort();
      if (JSON.stringify(ids) !== JSON.stringify(respaldo[tabla].map(r => String(r.id)).sort())) throw new Error('Cambio inesperado de contenido en ' + tabla);
    }
    // Prueba las restricciones reales sin crear ni modificar perfiles.
    await client.query('CREATE TEMP TABLE prueba_intereses (LIKE public.user_interests INCLUDING CONSTRAINTS INCLUDING DEFAULTS) ON COMMIT DROP');
    await client.query("INSERT INTO prueba_intereses (user_id, genre) SELECT '00000000-0000-0000-0000-000000000001'::uuid, unnest($1::text[])", [GENEROS_MUSICALES]);
    const ensayo = process.argv.includes('--dry-run');
    await client.query(ensayo ? 'ROLLBACK' : 'COMMIT');
    console.log(ensayo ? 'Prueba correcta; cambios revertidos.' : 'Base actualizada correctamente.');
    console.log('Generos aceptados:', generos.join(', '));
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Actualizacion cancelada sin cambios:', error.message);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
ejecutar();
