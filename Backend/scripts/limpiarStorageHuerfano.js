const pool = require('../Pool_DB');
const supabase = require('../services/supabaseClient');
const { extraerRutaPublica } = require('../services/storageService');

const eliminar = process.argv.includes('--delete');
const PERFILES_BUCKET = process.env.SUPABASE_PERFILES_BUCKET || 'perfiles';
const EVENTOS_BUCKET = process.env.SUPABASE_EVENTOS_BUCKET || 'eventos';
const REELS_BUCKET = process.env.SUPABASE_REELS_BUCKET || 'reels';

async function listar(bucket, carpeta) {
  const resultados = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(carpeta, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`No se pudo listar ${bucket}/${carpeta}: ${error.message}`);
    resultados.push(...(data || []));
    if (!data || data.length < 1000) return resultados;
    offset += data.length;
  }
}

async function listarPerfiles() {
  const carpetas = await listar(PERFILES_BUCKET, 'usuarios');
  const resultados = [];
  for (const carpeta of carpetas.filter((entrada) => !entrada.id)) {
    const archivos = await listar(PERFILES_BUCKET, `usuarios/${carpeta.name}`);
    resultados.push(...archivos
      .filter((archivo) => archivo.id)
      .map((archivo) => `usuarios/${carpeta.name}/${archivo.name}`));
  }
  return resultados;
}

async function listarArchivos() {
  const [perfiles, eventos, portadas, audios] = await Promise.all([
    listarPerfiles(),
    listar(EVENTOS_BUCKET, 'eventos'),
    listar(REELS_BUCKET, 'reels/portadas'),
    listar(REELS_BUCKET, 'reels/audios'),
  ]);
  return {
    perfiles,
    eventos: eventos.filter((archivo) => archivo.id).map((archivo) => `eventos/${archivo.name}`),
    reels: [
      ...portadas.filter((archivo) => archivo.id).map((archivo) => `reels/portadas/${archivo.name}`),
      ...audios.filter((archivo) => archivo.id).map((archivo) => `reels/audios/${archivo.name}`),
    ],
  };
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

  for (const [bucket, rutas] of Object.entries(huerfanos)) {
    if (rutas.length === 0) continue;
    const bucketReal = bucket === 'perfiles'
      ? PERFILES_BUCKET
      : bucket === 'eventos'
        ? EVENTOS_BUCKET
        : REELS_BUCKET;
    const { error } = await supabase.storage.from(bucketReal).remove(rutas);
    if (error) throw new Error(`No se pudieron eliminar archivos de ${bucketReal}: ${error.message}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
