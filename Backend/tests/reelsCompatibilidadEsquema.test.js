const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const rutaControlador = require.resolve('../Controllers/reelController');

function cargarControlador(columnasCompatibilidad) {
  const consultas = [];
  let insercion = null;
  const poolFalso = {
    async query(texto, valores = []) {
      consultas.push(texto);

      if (texto.includes('information_schema.columns')) {
        return { rows: columnasCompatibilidad, rowCount: columnasCompatibilidad.length };
      }

      if (/INSERT INTO users/.test(texto)) {
        return { rows: [{ id: 'usuario-prueba' }], rowCount: 1 };
      }

      if (/INSERT INTO reels/.test(texto)) {
        insercion = { texto, valores };
        return {
          rows: [{
            id: 7,
            titulo: 'Cancion de prueba',
            genero: 'rock',
            duracion: '0:30',
            portada_url: 'https://storage.test/portada.webp',
            audio_url: 'https://storage.test/audio.mp3',
            creador_id: 'usuario-prueba',
            color_principal: valores.find((valor) => /^#[0-9a-f]{6}$/.test(String(valor))) || null,
          }],
          rowCount: 1,
        };
      }

      if (/SELECT u\.profile_img_url/.test(texto)) {
        return { rows: [{ profile_img_url: null }], rowCount: 1 };
      }

      throw new Error(`Consulta no esperada en la prueba: ${texto}`);
    },
  };

  const originalLoad = Module._load;
  Module._load = function cargarModulo(request, parent, isMain) {
    if (request === '../Pool_DB') return poolFalso;
    if (request === '../services/supabaseClient') {
      return { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
    }
    if (request === '../services/storageService') {
      return {
        subirPortadaReel: async (archivo) => archivo
          ? { publicUrl: 'https://storage.test/portada.webp', path: 'portadas/portada.webp' }
          : null,
        subirAudioReel: async () => ({
          publicUrl: 'https://storage.test/audio.mp3',
          path: 'audios/audio.mp3',
        }),
        eliminarArchivoReel: async () => null,
      };
    }
    if (request === '../services/notificationService') {
      return {
        crearNotificacion: async () => null,
        eliminarNotificacion: async () => null,
        nombreActor: () => 'Tester',
        notificarMenciones: async () => null,
        notificarSeguidores: async () => null,
      };
    }
    if (request === '../services/moderationService') {
      return {
        asegurarEsquemaModeracion: async () => null,
        registrarDenuncia: async () => null,
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[rutaControlador];
  let controlador;
  try {
    controlador = require(rutaControlador);
  } finally {
    Module._load = originalLoad;
  }

  return {
    controlador,
    consultas,
    obtenerInsercion: () => insercion,
  };
}

function crearSolicitud() {
  return {
    body: {
      titulo: 'Cancion de prueba',
      genero: 'rock',
      color_principal: '#AABBCC',
    },
    files: {
      portada: [{ originalname: 'portada.webp' }],
      audio: [{ originalname: 'audio.mp3' }],
    },
    user: {
      id: '12345678-1234-1234-1234-123456789012',
      email: 'tester@example.com',
      user_metadata: { username: 'tester' },
    },
    accessToken: 'token-prueba',
  };
}

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(cuerpo) {
      this.body = cuerpo;
      return this;
    },
  };
}

test('crear reel completa columnas antiguas obligatorias y tolera que color_principal no exista', async () => {
  const escenario = cargarControlador([
    { column_name: 'album', is_nullable: 'NO', column_default: null },
    { column_name: 'descripcion', is_nullable: 'NO', column_default: null },
  ]);
  const respuesta = crearRespuesta();

  await escenario.controlador.crearReel(crearSolicitud(), respuesta);

  const insercion = escenario.obtenerInsercion();
  assert.equal(respuesta.statusCode, 201);
  assert.match(insercion.texto, /album/);
  assert.match(insercion.texto, /descripcion/);
  assert.doesNotMatch(insercion.texto, /color_principal/);
  assert.equal(insercion.valores.filter((valor) => valor === 'Cancion de prueba').length, 2);
  assert.ok(insercion.valores.includes(''));
  assert.doesNotMatch(escenario.consultas.join('\n'), /ALTER TABLE public?\.?reels/i);
});

test('crear reel simplificado omite campos retirados y persiste color cuando la columna existe', async () => {
  const escenario = cargarControlador([
    { column_name: 'color_principal', is_nullable: 'YES', column_default: null },
  ]);
  const respuesta = crearRespuesta();

  await escenario.controlador.crearReel(crearSolicitud(), respuesta);

  const insercion = escenario.obtenerInsercion();
  assert.equal(respuesta.statusCode, 201);
  assert.doesNotMatch(insercion.texto, /album|descripcion/);
  assert.match(insercion.texto, /color_principal/);
  assert.ok(insercion.valores.includes('#aabbcc'));
});

test('crear reel informa exactamente los datos obligatorios ausentes aunque no llegue body', async () => {
  const escenario = cargarControlador([]);
  const respuesta = crearRespuesta();

  await escenario.controlador.crearReel({ body: undefined, files: undefined }, respuesta);

  assert.equal(respuesta.statusCode, 400);
  assert.deepEqual(respuesta.body.camposFaltantes, ['titulo', 'genero', 'audio']);
  assert.match(respuesta.body.error, /titulo, genero, audio/);
  assert.equal(escenario.obtenerInsercion(), null);
});

test('crear reel acepta tema, genre y un audio individual normalizando el genero', async () => {
  const escenario = cargarControlador([]);
  const respuesta = crearRespuesta();
  const solicitud = crearSolicitud();
  solicitud.body = {
    tema: '  Cancion por alias  ',
    genre: '  ROCK  ',
  };
  solicitud.files = undefined;
  solicitud.file = {
    fieldname: 'audio',
    originalname: 'audio.mp3',
  };

  await escenario.controlador.crearReel(solicitud, respuesta);

  const insercion = escenario.obtenerInsercion();
  assert.equal(respuesta.statusCode, 201);
  assert.equal(insercion.valores[0], 'Cancion por alias');
  assert.equal(insercion.valores[1], 'rock');
  assert.doesNotMatch(insercion.texto, /album|descripcion/);
});

test('la migracion focalizada vuelve opcionales los campos antiguos y agrega el color', () => {
  const raiz = path.join(__dirname, '..', '..');
  const controlador = fs.readFileSync(
    path.join(raiz, 'Backend', 'Controllers', 'reelController.js'),
    'utf8'
  );
  const migracion = fs.readFileSync(
    path.join(raiz, 'Backend', 'BDD-Sql', 'Migrar_Reels_Simplificados.sql'),
    'utf8'
  );

  assert.match(controlador, /FROM information_schema\.columns/);
  assert.doesNotMatch(controlador, /ALTER TABLE (?:public\.)?reels[\s\S]{0,100}color_principal/i);
  assert.match(migracion, /ADD COLUMN IF NOT EXISTS color_principal text/i);
  assert.match(migracion, /ALTER COLUMN album DROP NOT NULL/i);
  assert.match(migracion, /ALTER COLUMN descripcion DROP NOT NULL/i);
});
