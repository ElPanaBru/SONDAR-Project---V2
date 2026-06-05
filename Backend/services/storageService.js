const crypto = require('crypto');
const path = require('path');
const supabase = require('./supabaseClient');

const EVENTOS_BUCKET = process.env.SUPABASE_EVENTOS_BUCKET || 'eventos';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function validarImagen(file) {
  if (!file) return;

  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new Error('Formato de imagen no permitido.');
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar los 5MB.');
  }
}

async function subirImagenEvento(file) {
  if (!file) return null;

  validarImagen(file);

  const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const storagePath = `eventos/${Date.now()}-${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage
    .from(EVENTOS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`No se pudo subir la imagen: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(EVENTOS_BUCKET)
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    publicUrl: data.publicUrl
  };
}

async function eliminarImagenEvento(storagePath) {
  if (!storagePath) return;

  await supabase.storage
    .from(EVENTOS_BUCKET)
    .remove([storagePath]);
}

module.exports = {
  subirImagenEvento,
  eliminarImagenEvento
};
