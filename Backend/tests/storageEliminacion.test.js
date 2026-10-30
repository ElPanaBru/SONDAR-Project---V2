const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const removals = [];
let authenticatedStorageCalls = 0;
let nextError = null;

const storage = {
  from(bucket) {
    return {
      async remove(paths) {
        removals.push({ bucket, paths });
        return { data: nextError ? null : paths, error: nextError };
      },
    };
  },
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === './supabaseClient') {
    return {
      storage,
      crearStorageAutenticado(accessToken) {
        authenticatedStorageCalls += 1;
        assert.equal(accessToken, 'jwt-usuario');
        return storage;
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const {
  eliminarArchivoReel,
  eliminarAvatarUsuario,
  eliminarImagenEvento,
} = require('../services/storageService');
Module._load = originalLoad;

test('el backend borra archivos con el JWT del usuario antes de eliminar su cuenta', async () => {
  removals.length = 0;
  authenticatedStorageCalls = 0;
  nextError = null;

  await eliminarArchivoReel('reels/portadas/usuario/portada.png', 'jwt-usuario');
  await eliminarArchivoReel('reels/audios/usuario/audio.mp3', 'jwt-usuario');
  await eliminarAvatarUsuario('usuarios/usuario/avatar.png', 'jwt-usuario');
  await eliminarImagenEvento('eventos/imagen.png', 'jwt-usuario');

  assert.equal(authenticatedStorageCalls, 4);
  assert.deepEqual(removals, [
    { bucket: 'reels', paths: ['reels/portadas/usuario/portada.png'] },
    { bucket: 'reels', paths: ['reels/audios/usuario/audio.mp3'] },
    { bucket: 'perfiles', paths: ['usuarios/usuario/avatar.png'] },
    { bucket: 'eventos', paths: ['eventos/imagen.png'] },
  ]);
});

test('los errores de Supabase Storage se propagan al controlador', async () => {
  nextError = { message: 'storage unavailable' };
  await assert.rejects(
    eliminarArchivoReel('reels/audios/usuario/audio.mp3', 'jwt-usuario'),
    /storage unavailable/
  );
  nextError = null;
});
