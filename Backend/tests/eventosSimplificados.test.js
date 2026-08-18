const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const consultasCliente = [];

function resultado(rows = []) {
  return { rows, rowCount: rows.length };
}

const poolFalso = {
  async query(sql) {
    return resultado();
  },
  async connect() {
    return {
      async query(sql, params = []) {
        const texto = String(sql);
        consultasCliente.push({ texto, params });

        if (/INSERT INTO eventos/.test(texto)) {
          return resultado([{
            id: 81,
            genero: params[0],
            lugar: params[1],
            fecha: params[2],
            precio: params[3],
            link: params[4],
            creador_id: params[5],
            latitud: params[6],
            longitud: params[7],
          }]);
        }

        return resultado();
      },
      release() {},
    };
  },
};

const originalLoad = Module._load;
Module._load = function cargarModulo(request, parent, isMain) {
  if (request === '../Pool_DB') return poolFalso;
  if (request === '../services/supabaseClient') {
    return { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  }
  if (request === '../services/storageService') {
    return { eliminarImagenEvento: async () => null };
  }
  if (request === '../services/notificationService') {
    return {
      crearNotificacion: async () => null,
      nombreActor: () => 'Banda de prueba',
      notificarSeguidores: async () => null,
    };
  }
  if (request === '../services/moderationService') {
    return {
      asegurarEsquemaModeracion: async () => null,
      registrarDenuncia: async () => ({ denunciado: true }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const eventoController = require('../Controllers/eventoController');
Module._load = originalLoad;

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('crear evento no requiere ni persiste titulo o descripcion heredados', async () => {
  const res = crearRespuesta();
  const creadorId = '11111111-1111-4111-8111-111111111111';

  await eventoController.crearEvento({
    user: {
      id: creadorId,
      email: 'banda@example.com',
      user_metadata: { username: 'banda-prueba' },
    },
    body: {
      genero: 'rock',
      ubicacion: 'Buenos Aires',
      fecha: '2026-09-20T22:00:00.000Z',
      precio: '2500',
      link: 'https://example.com/entradas',
      latitud: -34.6037,
      longitud: -58.3816,
      organizadores: '[]',
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.creador, 'banda-prueba');
  assert.equal(res.body.genero, 'rock');
  assert.equal(res.body.titulo, undefined);
  assert.equal(res.body.descripcion, undefined);

  const alta = consultasCliente.find(({ texto }) => /INSERT INTO eventos/.test(texto));
  assert.ok(alta);
  assert.match(alta.texto, /INSERT INTO eventos \(genero, lugar, fecha, precio, link, creador_id, latitud, longitud\)/);
  assert.doesNotMatch(alta.texto, /titulo|descripcion/);
  assert.deepEqual(alta.params, [
    'rock',
    'Buenos Aires',
    '2026-09-20T22:00:00.000Z',
    2500,
    'https://example.com/entradas',
    creadorId,
    -34.6037,
    -58.3816,
  ]);
});

test('crear evento acepta los nombres de ubicacion y coordenadas usados por clientes anteriores', async () => {
  const res = crearRespuesta();
  const creadorId = '22222222-2222-4222-8222-222222222222';
  const cantidadConsultasInicial = consultasCliente.length;

  await eventoController.crearEvento({
    user: {
      id: creadorId,
      email: 'artista@example.com',
      user_metadata: { username: 'artista-prueba' },
    },
    body: {
      genero: ' jazz ',
      ubicacion: ' ',
      lugar: ' Meridiano de Greenwich ',
      fecha: '2026-09-21T20:30:00.000Z',
      precio: '',
      latitud: '',
      longitud: '',
      lat: 0,
      lng: 0,
      organizadores: [],
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.genero, 'jazz');
  assert.equal(res.body.lugar, 'Meridiano de Greenwich');

  const nuevasConsultas = consultasCliente.slice(cantidadConsultasInicial);
  const alta = nuevasConsultas.find(({ texto }) => /INSERT INTO eventos/.test(texto));
  assert.ok(alta);
  assert.deepEqual(alta.params, [
    'jazz',
    'Meridiano de Greenwich',
    '2026-09-21T20:30:00.000Z',
    null,
    null,
    creadorId,
    0,
    0,
  ]);
});

test('crear evento informa cuales datos obligatorios no llegaron', async () => {
  const res = crearRespuesta();

  await eventoController.crearEvento({
    user: {
      id: '33333333-3333-4333-8333-333333333333',
      email: 'banda@example.com',
      user_metadata: {},
    },
    body: {
      genero: 'rock',
      fecha: '2026-09-22T21:00:00.000Z',
      latitud: -34.6,
    },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.camposFaltantes, ['ubicacion', 'longitud']);
  assert.match(res.body.error, /ubicacion, longitud/);
});
