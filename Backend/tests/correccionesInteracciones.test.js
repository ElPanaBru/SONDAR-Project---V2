const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const raiz = path.join(__dirname, '..', '..');
const originalLoad = Module._load;
Module._load = function cargarModulo(request, parent, isMain) {
  if (request === './supabaseClient') {
    return {
      storage: {
        from() {
          return {
            async upload() {
              return { error: null };
            },
            getPublicUrl(storagePath) {
              return { data: { publicUrl: `https://storage.test/${storagePath}` } };
            },
          };
        },
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const storageService = require('../services/storageService');
Module._load = originalLoad;

test('storage acepta un WAV real y rechaza contenido que solo declara ser audio', async () => {
  const wav = Buffer.from('RIFF0000WAVEfmt ');
  const subido = await storageService.subirAudioReel({
    originalname: 'prueba.wav',
    mimetype: 'audio/x-wav',
    size: wav.length,
    buffer: wav,
  });
  assert.match(subido.publicUrl, /reels\/audios/);

  const falso = Buffer.from('esto no es audio');
  await assert.rejects(
    storageService.subirAudioReel({
      originalname: 'falso.mp3',
      mimetype: 'audio/mpeg',
      size: falso.length,
      buffer: falso,
    }),
    (error) => error.status === 415 && /audio valido/.test(error.message)
  );
});

test('reels conserva portada opcional, audio obligatorio y enlace individual', () => {
  const pagina = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Descubrir.jsx'), 'utf8');
  const emailDenuncia = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'lib', 'reportarContenido.js'), 'utf8');
  const controlador = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'reelController.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(raiz, 'Backend', 'routes', 'reels.js'), 'utf8');

  assert.match(pagina, /if \(nuevoReel\.portadaFile\)/);
  assert.match(pagina, /!nuevoReel\.audioFile/);
  assert.match(pagina, /url: crearEnlaceLanzamiento\(lanzamiento\)/);
  assert.match(pagina, /api\/reels\/\$\{reelCompartidoBackendId\}/);
  assert.match(emailDenuncia, /const urlContenido = url \|\| window\.location\.href/);
  assert.match(emailDenuncia, /url: urlContenido/);
  assert.match(controlador, /obtenerReel: async/);
  assert.match(controlador, /!tema \|\| !album \|\| !genero \|\| !audioFile/);
  assert.match(rutas, /router\.get\('\/:id', reelController\.obtenerReel\)/);
  assert.match(rutas, /procesarArchivosReel/);
});

test('comunidad expone respuestas, likes y denuncias sin compartir publicaciones', () => {
  const pagina = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const controlador = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'comunidadController.js'), 'utf8');
  const rutas = fs.readFileSync(path.join(raiz, 'Backend', 'routes', 'comunidades.js'), 'utf8');

  assert.doesNotMatch(pagina, /compartirPublicacion/);
  assert.match(pagina, /const votarComentario = async/);
  assert.match(pagina, /body: JSON\.stringify\(\{ texto, parentId \}\)/);
  assert.match(pagina, /renderizarComentario\(hilo, respuesta, nivel \+ 1\)/);
  assert.match(pagina, /setDenunciaPendiente\(\{ tipo: "comentario"/);
  assert.match(controlador, /WHERE id = \$1 AND publicacion_id = \$2/);
  assert.match(controlador, /&comentario=\$\{comentarioId\}/);
  assert.match(rutas, /publicaciones\/:publicacionId\/denunciar/);
  assert.match(rutas, /comentarios\/:comentarioId\/denunciar/);
});

test('el login manual usa el mismo limite de espera que el inicio automatico', () => {
  const auth = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Auth.jsx'), 'utf8');
  assert.match(auth, /esperarConTimeout\(\s*supabase\.auth\.signInWithPassword/);
  assert.match(auth, /El inicio de sesion tardo demasiado/);
});
