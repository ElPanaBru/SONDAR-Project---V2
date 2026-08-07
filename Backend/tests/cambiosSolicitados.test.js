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
  if (consulta.startsWith('SELECT id FROM comunidades WHERE')) {
    return resultado([{ id: 'pop' }]);
  }
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

test('PUT y DELETE de membresia son idempotentes', async () => {
  miembroActivo = false;

  for (const method of ['PUT', 'PUT']) {
    const res = crearRespuesta();
    await comunidadController.establecerMembresia({
      method,
      params: { comunidadId: 'pop' },
      user: usuarioPrueba,
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.unido, true);
  }

  for (const method of ['DELETE', 'DELETE']) {
    const res = crearRespuesta();
    await comunidadController.establecerMembresia({
      method,
      params: { comunidadId: 'pop' },
      user: usuarioPrueba,
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.unido, false);
  }
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
  assert.match(paginaEventos, /setEstadoEventos\("pasados"\)/);
  assert.match(controladorEventos, /\['proximos', 'pasados', 'todos'\]/);
  assert.match(controladorEventos, /e\.fecha >= NOW\(\)/);
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

test('el proceso web no ejecuta DDL ni escribe tablas internas de Auth', () => {
  const raizBackend = path.join(__dirname, '..');
  const archivosRuntime = [
    path.join(raizBackend, 'index.js'),
    ...fs.readdirSync(path.join(raizBackend, 'Controllers')).map((archivo) => (
      path.join(raizBackend, 'Controllers', archivo)
    )),
    ...fs.readdirSync(path.join(raizBackend, 'services')).map((archivo) => (
      path.join(raizBackend, 'services', archivo)
    )),
  ].filter((archivo) => archivo.endsWith('.js'));
  const runtime = archivosRuntime.map((archivo) => fs.readFileSync(archivo, 'utf8')).join('\n');

  assert.doesNotMatch(runtime, /\bCREATE\s+(?:TABLE|INDEX|POLICY)\b/i);
  assert.doesNotMatch(runtime, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(runtime, /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?auth\.(?:users|identities)\b/i);
});

test('la migracion integral agrega integridad, RLS e indices de consultas reales', () => {
  const raiz = path.join(__dirname, '..', '..');
  const migracion = fs.readFileSync(
    path.join(raiz, 'supabase', 'migrations', '202608070001_optimizacion_integral.sql'),
    'utf8'
  );

  assert.match(migracion, /comunidad_publicaciones_evento_fk/);
  assert.match(migracion, /comunidad_publicaciones_reel_fk/);
  assert.match(migracion, /eventos_fecha_id_idx/);
  assert.match(migracion, /reel_comments_reel_created_idx/);
  assert.match(migracion, /notifications_user_unread_created_idx/);
  assert.match(migracion, /ALTER TABLE public\.comunidad_miembros ENABLE ROW LEVEL SECURITY/);
  assert.match(migracion, /CREATE POLICY comunidad_miembros_insert_own/);
  assert.match(migracion, /REVOKE INSERT, UPDATE, DELETE ON TABLE/);
});

test('un alta publica no puede solicitar privilegios de administrador', () => {
  const controlador = fs.readFileSync(
    path.join(__dirname, '..', 'Controllers', 'usuarioController.js'),
    'utf8'
  );
  assert.match(controlador, /TIPOS_USUARIO_PUBLICOS = new Set\(\['musico', 'organizador'\]\)/);
  assert.match(controlador, /TIPOS_USUARIO_PUBLICOS\.has\(tipoUsuario\)/);
});

test('los validadores de dominio limitan volumen, URLs y catalogos', () => {
  const { enteroLimitado, textoLimitado, urlHttpOpcional } = require('../domain/validacion');
  const { generoMusicalValido, generoReelValido } = require('../domain/catalogos');

  assert.equal(enteroLimitado('9999', { predeterminado: 30, maximo: 50 }), 50);
  assert.match(textoLimitado('x'.repeat(51), { maximo: 50, campo: 'Tema' }).error, /50/);
  assert.equal(urlHttpOpcional('javascript:alert(1)').error.length > 0, true);
  assert.equal(urlHttpOpcional('https://sondar.test/evento').url, 'https://sondar.test/evento');
  assert.equal(generoMusicalValido('ROCK'), true);
  assert.equal(generoMusicalValido('electronica'), false);
  assert.equal(generoReelValido('otros'), true);
});

test('el limitador devuelve 429 y cabeceras estandar al superar la cuota', () => {
  const { crearRateLimiter } = require('../middlewares/rateLimiter');
  const limiter = crearRateLimiter({ nombre: `prueba-${Date.now()}`, ventanaMs: 60_000, maximo: 1 });
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    set(nombre, valor) {
      headers[nombre] = valor;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let continuaciones = 0;
  limiter({ ip: '127.0.0.55' }, res, () => { continuaciones += 1; });
  limiter({ ip: '127.0.0.55' }, res, () => { continuaciones += 1; });

  assert.equal(continuaciones, 1);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, 'RATE_LIMITED');
  assert.equal(headers['RateLimit-Limit'], '1');
  assert.ok(headers['Retry-After']);
});

test('el frontend no expone EmailJS y carga comentarios bajo demanda', () => {
  const raiz = path.join(__dirname, '..', '..');
  const soporte = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Soporte.jsx'), 'utf8');
  const reportes = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'lib', 'reportarContenido.js'), 'utf8');
  const descubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Descubrir.jsx'), 'utf8');
  const comunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');

  assert.doesNotMatch(`${soporte}\n${reportes}`, /emailjs|VITE_EMAILJS/i);
  assert.match(soporte, /\/api\/soporte\/mensaje/);
  assert.match(descubrir, /comentariosCargadosRef/);
  assert.doesNotMatch(descubrir, /reelsBackend\.map\(async \(reel\)/);
  assert.match(comunidad, /publicaciones\/\$\{id\}\/comentarios/);
  assert.doesNotMatch(comunidad, /Comentario local hasta reconectar/);
});

test('health, 404 y CORS responden con contrato y cabeceras seguras', async (t) => {
  const { app } = require('../index');
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(Object.keys(await health.json()).sort(), ['ok', 'version']);
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(health.headers.get('x-request-id'));

  const inexistente = await fetch(`${base}/api/no-existe`);
  assert.equal(inexistente.status, 404);
  assert.equal((await inexistente.json()).code, 'NOT_FOUND');

  const corsDenegado = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://origen-no-permitido.example' },
  });
  assert.equal(corsDenegado.status, 403);
  assert.equal((await corsDenegado.json()).code, 'CORS_ORIGIN_DENIED');
});
