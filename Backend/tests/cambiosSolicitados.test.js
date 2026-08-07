const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

let miembroActivo = false;
let siguientePublicacionId = 41;

const comunidadRow = {
  id: 'pop',
  nombre: '@pop',
  titulo: 'Pop',
  genero: 'pop',
  descripcion: 'Foro de prueba',
  portada_url: null,
  publicaciones: 0,
  miembros: 0,
  unido: false,
};

function resultado(rows = []) {
  return { rows, rowCount: rows.length };
}

async function ejecutarQuery(sql) {
  const consulta = String(sql).replace(/\s+/g, ' ').trim();

  if (consulta.includes('SELECT c.*') && consulta.includes('FROM comunidades c')) {
    return resultado([{ ...comunidadRow, unido: miembroActivo, miembros: miembroActivo ? 1 : 0 }]);
  }
  if (consulta.startsWith('SELECT id, genero FROM comunidades')) {
    return resultado([{ id: 'pop', genero: 'pop' }]);
  }
  if (consulta.startsWith('SELECT 1 FROM comunidad_miembros')) {
    return resultado(miembroActivo ? [{ '?column?': 1 }] : []);
  }
  if (consulta.startsWith('INSERT INTO comunidad_publicaciones')) {
    const id = siguientePublicacionId;
    siguientePublicacionId += 1;
    return resultado([{
      id,
      comunidad_id: 'pop',
      user_id: '11111111-1111-4111-8111-111111111111',
      tipo: 'reciente',
      titulo: 'Publicacion de prueba',
      texto: 'Contenido de prueba',
      etiqueta: 'pop',
      created_at: new Date().toISOString(),
    }]);
  }
  if (consulta.startsWith('SELECT u.username, u.email')) {
    return resultado([{ username: 'tester', email: 'tester@example.com' }]);
  }

  return resultado();
}

const poolFalso = {
  query: ejecutarQuery,
  async connect() {
    return {
      async query(sql) {
        const consulta = String(sql).replace(/\s+/g, ' ').trim();
        if (consulta.startsWith('SELECT id FROM comunidades')) return resultado([{ id: 'pop' }]);
        if (consulta.startsWith('SELECT 1 FROM comunidad_miembros')) {
          return resultado(miembroActivo ? [{ '?column?': 1 }] : []);
        }
        if (consulta.startsWith('INSERT INTO comunidad_miembros')) {
          miembroActivo = true;
          return resultado();
        }
        if (consulta.startsWith('DELETE FROM comunidad_miembros')) {
          miembroActivo = false;
          return resultado();
        }
        if (consulta.startsWith('SELECT COUNT(*)::int AS miembros')) {
          return resultado([{ miembros: miembroActivo ? 1 : 0 }]);
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
  if (request === '../services/notificationService') {
    return {
      crearNotificacion: async () => null,
      eliminarNotificacion: async () => null,
      nombreActor: () => 'Tester',
      notificarMenciones: async () => null,
      notificarSeguidores: async () => null,
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const comunidadController = require('../Controllers/comunidadController');
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

const usuarioPrueba = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'tester@example.com',
  user_metadata: { username: 'tester' },
};

test('las comunidades informan la membresia del usuario', async () => {
  miembroActivo = false;
  const res = crearRespuesta();
  await comunidadController.listarComunidades({ headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].unido, false);
  assert.equal(res.body[0].miembros, 0);
});

test('unirse y salir del foro actualiza el estado persistido', async () => {
  miembroActivo = false;
  const req = { params: { comunidadId: 'pop' }, user: usuarioPrueba };

  const ingreso = crearRespuesta();
  await comunidadController.alternarMembresia(req, ingreso);
  assert.deepEqual(ingreso.body, { comunidadId: 'pop', unido: true, miembros: 1 });

  const salida = crearRespuesta();
  await comunidadController.alternarMembresia(req, salida);
  assert.deepEqual(salida.body, { comunidadId: 'pop', unido: false, miembros: 0 });
});

test('crear una publicacion exige membresia en el foro', async () => {
  miembroActivo = false;
  const res = crearRespuesta();
  await comunidadController.crearPublicacion({
    params: { comunidadId: 'pop' },
    user: usuarioPrueba,
    body: { titulo: 'Publicacion de prueba', texto: 'Contenido de prueba' },
  }, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /Unite a este foro/);
});

test('un miembro puede crear una publicacion', async () => {
  miembroActivo = true;
  const res = crearRespuesta();
  await comunidadController.crearPublicacion({
    params: { comunidadId: 'pop' },
    user: usuarioPrueba,
    body: { titulo: 'Publicacion de prueba', texto: 'Contenido de prueba', tipo: 'reciente' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.comunidadId, 'pop');
  assert.equal(res.body.titulo, 'Publicacion de prueba');
});

test('eventos ya no acepta ni procesa imagenes y usa el logo predeterminado', () => {
  const raiz = path.join(__dirname, '..', '..');
  const rutaEventos = fs.readFileSync(path.join(raiz, 'Backend', 'routes', 'eventos.js'), 'utf8');
  const controladorEventos = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'eventoController.js'), 'utf8');
  const controladorUsuarios = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'usuarioController.js'), 'utf8');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const paginaBuscar = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Buscar.jsx'), 'utf8');

  assert.doesNotMatch(rutaEventos, /multer|upload\.single\(['"]imagen['"]\)/);
  assert.doesNotMatch(controladorEventos, /subirImagenEvento|req\.file/);
  assert.match(paginaEventos, /LOGO_EVENTO_PREDETERMINADO = ["']\/sondar-logo\.png["']/);
  assert.doesNotMatch(paginaEventos, /type=["']file["']/);
  assert.doesNotMatch(paginaEventos, /new FormData\(\)/);
  assert.match(paginaEventos, /body:\s*datosEvento/);
  assert.match(controladorUsuarios, /imagen:\s*["']\/sondar-logo\.png["']/);
  assert.match(paginaBuscar, /img:\s*["']\/sondar-logo\.png["']/);
});

test('comunidad conserva la estructura, reglas y restricciones solicitadas', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const estilosComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'comunidad.css'), 'utf8');
  const migracion = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Migrar_A_Esquema_Minimo.sql'), 'utf8');

  assert.match(paginaComunidad, /const reglasForo = \[/);
  assert.match(paginaComunidad, /disabled=\{!usuario \|\| !comunidadActiva\.unido\}/);
  assert.match(paginaComunidad, /Filtrar por:/);
  assert.doesNotMatch(paginaComunidad, /Community highlights/i);
  assert.doesNotMatch(paginaComunidad, /Publicaciones guardadas/i);

  const posicionReglas = paginaComunidad.indexOf('<h2>Reglas del foro</h2>');
  const posicionRecursos = paginaComunidad.indexOf('<h2>Recursos</h2>');
  assert.ok(posicionReglas > 0 && posicionRecursos > posicionReglas);
  assert.match(estilosComunidad, /\.comunidad-reglas\s*\{[^}]*color:\s*rgba\(255,\s*255,\s*255,/s);
  assert.doesNotMatch(estilosComunidad, /@media \(max-width: 900px\)[\s\S]*?\.detalle-comunidad\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(estilosComunidad, /@media \(max-width: 1180px\)[\s\S]*?\.subreddit-list\s*\{[^}]*display:\s*none;/);
  assert.match(migracion, /CREATE TABLE IF NOT EXISTS public\.comunidad_miembros/);
  assert.doesNotMatch(migracion, /DROP TABLE IF EXISTS public\.comunidad_miembros/);
});
