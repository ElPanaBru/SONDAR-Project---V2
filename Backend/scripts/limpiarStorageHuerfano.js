const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const { extraerRutaPublica } = require('../services/storageService');

const eliminar = process.argv.includes('--delete');
const PERFILES_BUCKET = process.env.SUPABASE_PERFILES_BUCKET || 'perfiles';
const EVENTOS_BUCKET = process.env.SUPABASE_EVENTOS_BUCKET || 'eventos';
const REELS_BUCKET = process.env.SUPABASE_REELS_BUCKET || 'reels';

async function listarArchivos() {
  const result = await pool.query(
    `SELECT bucket_id, name
     FROM storage.objects
     WHERE bucket_id = ANY($1::text[])
     ORDER BY bucket_id, name`,
    [[PERFILES_BUCKET, EVENTOS_BUCKET, REELS_BUCKET]]
  );
  const rutasDe = (bucket) => result.rows
    .filter((row) => row.bucket_id === bucket && !row.name.endsWith('/.emptyFolderPlaceholder'))
    .map((row) => row.name);
  return {
    perfiles: rutasDe(PERFILES_BUCKET),
    eventos: rutasDe(EVENTOS_BUCKET),
    reels: rutasDe(REELS_BUCKET),
  };
}

function storageParaLimpieza() {
  const accessToken = process.env.SUPABASE_STORAGE_ACCESS_TOKEN;
  if (accessToken) return supabase.crearStorageAutenticado(accessToken);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (serviceKey.split('.').length === 3) return supabase.storage;

  throw new Error(
    'Para borrar huerfanos configura SUPABASE_STORAGE_ACCESS_TOKEN o una SUPABASE_SERVICE_ROLE_KEY JWT heredada.'
  );
}

async function main() {
  const [usuarios, eventos, reels, archivos] = await Promise.all([
    pool.query('SELECT profile_img_path, profile_img_url FROM users'),
    pool.query('SELECT img_path, img_url FROM eventos'),
    pool.query('SELECT portada_path, portada_url, audio_path, audio_url FROM reels'),
    listarArchivos(),
  ]);

  const usados = {
    perfiles: new Set(usuarios.rows.map((row) =>
      row.profile_img_path || extraerRutaPublica(row.profile_img_url, PERFILES_BUCKET)
    ).filter(Boolean)),
    eventos: new Set(eventos.rows.map((row) =>
      row.img_path || extraerRutaPublica(row.img_url, EVENTOS_BUCKET)
    ).filter(Boolean)),
    reels: new Set(reels.rows.flatMap((row) => [
      row.portada_path || extraerRutaPublica(row.portada_url, REELS_BUCKET),
      row.audio_path || extraerRutaPublica(row.audio_url, REELS_BUCKET),
    ]).filter(Boolean)),
  };
  const huerfanos = {
    perfiles: archivos.perfiles.filter((ruta) => !usados.perfiles.has(ruta)),
    eventos: archivos.eventos.filter((ruta) => !usados.eventos.has(ruta)),
    reels: archivos.reels.filter((ruta) => !usados.reels.has(ruta)),
  };

  console.log(JSON.stringify({ modo: eliminar ? 'eliminar' : 'simulacion', huerfanos }, null, 2));
  if (!eliminar) return;

  const storage = storageParaLimpieza();
  for (const [bucket, rutas] of Object.entries(huerfanos)) {
    if (rutas.length === 0) continue;
    const bucketReal = bucket === 'perfiles'
      ? PERFILES_BUCKET
      : bucket === 'eventos'
        ? EVENTOS_BUCKET
        : REELS_BUCKET;
    for (let indice = 0; indice < rutas.length; indice += 100) {
      const lote = rutas.slice(indice, indice + 100);
      const { error } = await storage.from(bucketReal).remove(lote);
      if (error) throw new Error(`No se pudieron eliminar archivos de ${bucketReal}: ${error.message}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
