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
  assert.deepEqual(res.body.generos, ['rock']);
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

  const altaGeneros = consultasCliente.find(({ texto }) => /INSERT INTO evento_generos/.test(texto));
  assert.ok(altaGeneros);
  assert.deepEqual(altaGeneros.params, [81, ['rock']]);
});

test('crear evento persiste hasta tres generos ordenados y conserva el primero como principal', async () => {
  const res = crearRespuesta();
  const cantidadConsultasInicial = consultasCliente.length;

  await eventoController.crearEvento({
    user: {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'festival@example.com',
      user_metadata: { username: 'festival-prueba' },
    },
    body: {
      generos: [' Alternativo ', 'punk', 'reggae', 'punk'],
      ubicacion: 'La Plata',
      fecha: '2026-09-23T20:00:00.000Z',
      latitud: -34.9214,
      longitud: -57.9544,
      organizadores: [],
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.genero, 'alternativo');
  assert.deepEqual(res.body.generos, ['alternativo', 'punk', 'reggae']);

  const nuevasConsultas = consultasCliente.slice(cantidadConsultasInicial);
  const altaEvento = nuevasConsultas.find(({ texto }) => /INSERT INTO eventos/.test(texto));
  const altaGeneros = nuevasConsultas.find(({ texto }) => /INSERT INTO evento_generos/.test(texto));
  assert.equal(altaEvento.params[0], 'alternativo');
  assert.deepEqual(altaGeneros.params, [81, ['alternativo', 'punk', 'reggae']]);
});

test('crear evento rechaza mas de tres generos o generos fuera del catalogo', async () => {
  const reqBase = {
    user: {
      id: '55555555-5555-4555-8555-555555555555',
      email: 'festival@example.com',
      user_metadata: {},
    },
    body: {
      ubicacion: 'Rosario',
      fecha: '2026-09-24T20:00:00.000Z',
      latitud: -32.9587,
      longitud: -60.6939,
    },
  };

  const demasiados = crearRespuesta();
  await eventoController.crearEvento({
    ...reqBase,
    body: { ...reqBase.body, generos: ['rock', 'punk', 'reggae', 'latina'] },
  }, demasiados);
  assert.equal(demasiados.statusCode, 400);
  assert.match(demasiados.body.error, /hasta 3 generos/);

  const desconocido = crearRespuesta();
  await eventoController.crearEvento({
    ...reqBase,
    body: { ...reqBase.body, generos: ['tango'] },
  }, desconocido);
  assert.equal(desconocido.statusCode, 400);
  assert.match(desconocido.body.error, /Generos no permitidos: tango/);
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
