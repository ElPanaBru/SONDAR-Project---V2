const crypto = require('crypto');
const path = require('path');
const supabase = require('./supabaseClient');

const EVENTOS_BUCKET = process.env.SUPABASE_EVENTOS_BUCKET || 'eventos';
const REELS_BUCKET = process.env.SUPABASE_REELS_BUCKET || 'reels';
const PERFILES_BUCKET = process.env.SUPABASE_PERFILES_BUCKET || 'perfiles';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
]);

function errorArchivo(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function tieneFirmaImagen(file) {
  const buffer = file?.buffer;
  if (!buffer || buffer.length < 12) return false;

  if (file.mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (file.mimetype === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (file.mimetype === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (file.mimetype === 'image/gif') {
    const firma = buffer.subarray(0, 6).toString('ascii');
    return firma === 'GIF87a' || firma === 'GIF89a';
  }
  return false;
}

function tieneFirmaAudio(file) {
  const buffer = file?.buffer;
  if (!buffer || buffer.length < 12) return false;
  const mime = file.mimetype;

  if (mime === 'audio/mpeg' || mime === 'audio/mp3') {
    return buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  if (mime === 'audio/wav' || mime === 'audio/x-wav' || mime === 'audio/wave') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
  }
  if (mime === 'audio/ogg') {
    return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  }
  if (mime === 'audio/webm') {
    return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  if (mime === 'audio/mp4' || mime === 'audio/x-m4a') {
    return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}

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
    throw errorArchivo('Formato de imagen no permitido.', 415);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw errorArchivo('La imagen no puede superar los 5MB.', 413);
  }

  if (!tieneFirmaImagen(file)) {
    throw errorArchivo('El archivo seleccionado no contiene una imagen valida.', 415);
  }
}

function validarAudio(file) {
  if (!file) return;

  if (!AUDIO_MIME_TYPES.has(file.mimetype)) {
    throw errorArchivo('Formato de audio no permitido.', 415);
  }

  if (file.size > MAX_AUDIO_BYTES) {
    throw errorArchivo('El audio no puede superar los 20MB.', 413);
  }

  if (!tieneFirmaAudio(file)) {
    throw errorArchivo('El archivo seleccionado no contiene un audio valido.', 415);
  }
}

async function subirArchivo(bucket, carpeta, file, validar, accessToken) {
  if (!file) return null;

  validar(file);

  const extension = path.extname(file.originalname || '').toLowerCase();
  const storagePath = `${carpeta}/${Date.now()}-${crypto.randomUUID()}${extension}`;

  const storage = accessToken
    ? supabase.crearStorageAutenticado?.(accessToken) || supabase.storage
    : supabase.storage;
  const { error } = await storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`No se pudo subir el archivo: ${error.message}`);
  }

  const { data } = storage
    .from(bucket)
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: data.publicUrl
  };
}

async function subirPortadaReel(file, userId, accessToken) {
  const carpeta = userId ? `reels/portadas/${userId}` : 'reels/portadas';
  return subirArchivo(REELS_BUCKET, carpeta, file, validarImagen, accessToken);
}

async function subirAudioReel(file, userId, accessToken) {
  const carpeta = userId ? `reels/audios/${userId}` : 'reels/audios';
  return subirArchivo(REELS_BUCKET, carpeta, file, validarAudio, accessToken);
}

async function subirAvatarUsuario(file, userId, accessToken) {
  return subirArchivo(PERFILES_BUCKET, `usuarios/${userId}`, file, validarImagen, accessToken);
}

async function eliminarImagenEvento(storagePath, accessToken) {
  if (!storagePath) return;

  const storage = supabase.crearStorageAutenticado?.(accessToken) || supabase.storage;
  const { error } = await storage
    .from(EVENTOS_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(`No se pudo eliminar la imagen del evento: ${error.message}`);
}

async function eliminarArchivoReel(storagePath, accessToken) {
  if (!storagePath) return;

  const storage = supabase.crearStorageAutenticado?.(accessToken) || supabase.storage;
  const { error } = await storage
    .from(REELS_BUCKET)
    .remove([storagePath]);
  if (error) throw new Error(`No se pudo eliminar el archivo de la preview: ${error.message}`);
}

async function eliminarAvatarUsuario(storagePath, accessToken) {
  if (!storagePath) return;

  const storage = supabase.crearStorageAutenticado?.(accessToken) || supabase.storage;
  const { error } = await storage
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
