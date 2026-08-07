const crypto = require('crypto');
const path = require('path');
const supabase = require('./supabaseClient');

const EVENTOS_BUCKET = process.env.SUPABASE_EVENTOS_BUCKET || 'eventos';
const REELS_BUCKET = process.env.SUPABASE_REELS_BUCKET || 'reels';
const PERFILES_BUCKET = process.env.SUPABASE_PERFILES_BUCKET || 'perfiles';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AUDIO_MIME_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4']);

function extraerRutaPublica(publicUrl, bucket) {
  if (!publicUrl) return null;
  const marcador = `/object/public/${bucket}/`;
  const indice = String(publicUrl).indexOf(marcador);
  if (indice < 0) return null;
  const ruta = String(publicUrl).slice(indice + marcador.length).split('?')[0];
  try {
    return decodeURIComponent(ruta);
  } catch {
    return ruta;
  }
}

function validarImagen(file) {
  if (!file) return;

  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new Error('Formato de imagen no permitido.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar los 5MB.');
  }
}

function validarAudio(file) {
  if (!file) return;

  if (!AUDIO_MIME_TYPES.has(file.mimetype)) {
    throw new Error('Formato de audio no permitido.');
  }

  if (file.size > MAX_AUDIO_BYTES) {
    throw new Error('El audio no puede superar los 20MB.');
  }
}

async function subirArchivo(bucket, carpeta, file, validar) {
  if (!file) return null;

  validar(file);

  const extension = path.extname(file.originalname || '').toLowerCase();
  const storagePath = `${carpeta}/${Date.now()}-${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: data.publicUrl
  };
}

async function subirPortadaReel(file) {
  return subirArchivo(REELS_BUCKET, 'reels/portadas', file, validarImagen);
}

async function subirAudioReel(file) {
  return subirArchivo(REELS_BUCKET, 'reels/audios', file, validarAudio);
}

async function subirAvatarUsuario(file, userId) {
  return subirArchivo(PERFILES_BUCKET, `usuarios/${userId}`, file, validarImagen);
}

async function eliminarImagenEvento(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(EVENTOS_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(`No se pudo eliminar la imagen del evento: ${error.message}`);
}

async function eliminarArchivoReel(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(REELS_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(`No se pudo eliminar el archivo del reel: ${error.message}`);
}

async function eliminarAvatarUsuario(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(PERFILES_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(`No se pudo eliminar el avatar: ${error.message}`);
}

module.exports = {
  eliminarImagenEvento,
  subirPortadaReel,
  subirAudioReel,
  eliminarArchivoReel,
  subirAvatarUsuario,
  eliminarAvatarUsuario,
  extraerRutaPublica,
  EVENTOS_BUCKET,
  REELS_BUCKET,
  PERFILES_BUCKET,
};
