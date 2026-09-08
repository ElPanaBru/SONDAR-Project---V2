const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const usuario = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'tester@example.com',
};
let respuestaLogin = { data: { user: usuario }, error: null };
let credencialesRecibidas = null;

const originalLoad = Module._load;
Module._load = function cargarModulo(request, parent, isMain) {
  if (request === '../services/supabaseClient') {
    return {
      authClient: {
        auth: {
          async signInWithPassword(credenciales) {
            credencialesRecibidas = credenciales;
            return respuestaLogin;
          },
        },
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const confirmarPasswordEliminacion = require('../middlewares/confirmarPasswordEliminacion');
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

test('la confirmacion de borrado exige una contrasena', async () => {
  const res = crearRespuesta();
  let siguienteEjecutado = false;

  await confirmarPasswordEliminacion({ user: usuario, body: {} }, res, () => {
    siguienteEjecutado = true;
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /contrasena/);
  assert.equal(siguienteEjecutado, false);
});

test('la confirmacion de borrado rechaza credenciales incorrectas', async () => {
  respuestaLogin = { data: { user: null }, error: new Error('Invalid login credentials') };
  const res = crearRespuesta();
  let siguienteEjecutado = false;

  await confirmarPasswordEliminacion({
    user: usuario,
    body: { password: 'incorrecta' },
  }, res, () => {
    siguienteEjecutado = true;
  });

  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /incorrecta/);
  assert.equal(siguienteEjecutado, false);
});

test('la confirmacion permite borrar solo si la contrasena corresponde al usuario autenticado', async () => {
  respuestaLogin = { data: { user: usuario }, error: null };
  credencialesRecibidas = null;
  const res = crearRespuesta();
  let siguienteEjecutado = false;

  await confirmarPasswordEliminacion({
    user: usuario,
    body: { password: 'Contrasena segura 123!' },
  }, res, () => {
    siguienteEjecutado = true;
  });

  assert.deepEqual(credencialesRecibidas, {
    email: usuario.email,
    password: 'Contrasena segura 123!',
  });
  assert.equal(siguienteEjecutado, true);
});

test('reels, publicaciones de foros y eventos usan la confirmacion antes del controlador', () => {
  const raizBackend = path.join(__dirname, '..');
  const reels = fs.readFileSync(path.join(raizBackend, 'routes', 'reels.js'), 'utf8');
  const comunidades = fs.readFileSync(path.join(raizBackend, 'routes', 'comunidades.js'), 'utf8');
  const eventos = fs.readFileSync(path.join(raizBackend, 'routes', 'eventos.js'), 'utf8');

  assert.match(reels, /router\.delete\('\/:id', authMiddleware, confirmarPasswordEliminacion, reelController\.eliminarReel\)/);
  assert.match(comunidades, /router\.delete\('\/publicaciones\/:publicacionId', authMiddleware, confirmarPasswordEliminacion, comunidadController\.eliminarPublicacion\)/);
  assert.match(eventos, /router\.delete\('\/:id', authMiddleware, confirmarPasswordEliminacion, eventoController\.eliminarEvento\)/);
});

test('las tres pantallas piden la contrasena y la envian al borrar', () => {
  const raiz = path.join(__dirname, '..', '..');
  const componente = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'ConfirmarEliminacionModal.jsx'), 'utf8');

  for (const pagina of ['Descubrir.jsx', 'Comunidad.jsx', 'Eventos.jsx']) {
    const contenido = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', pagina), 'utf8');
    assert.match(contenido, /<ConfirmarEliminacionModal/);
    assert.match(contenido, /body: \{ password \}/);
  }

  assert.match(componente, /role="alertdialog"/);
  assert.match(componente, /autoComplete="current-password"/);
  assert.match(componente, /Eliminar definitivamente/);
});

test('el like, los tags y la altura del panel usan la identidad visual solicitada', () => {
  const raiz = path.join(__dirname, '..', '..');
  const reelsCss = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'descubrir.css'), 'utf8');
  const comunidadCss = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'comunidad.css'), 'utf8');
  const eventosCss = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'eventos.css'), 'utf8');

  assert.match(reelsCss, /\.acciones-laterales \.accion-item:first-child \.accion-boton\.activo\s*\{[^}]*color:\s*#ff7900/s);
  assert.match(comunidadCss, /\.etiquetas-row span\s*\{[^}]*linear-gradient\(90deg, #ffae00, #ff5e00\)/s);
  assert.match(eventosCss, /\.eventos-sheet\.expandido\s*\{[^}]*top:\s*auto;[^}]*height:\s*clamp\(220px, 32dvh, 360px\)/s);
});
