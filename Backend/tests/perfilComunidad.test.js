const { sql } = require('./helpers/sql');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.join(__dirname, '..', '..');
const leer = (...partes) => fs.readFileSync(path.join(raiz, ...partes), 'utf8');

test('la comunidad de perfil convive con foros y mantiene guardados de previews', () => {
  const esquema = sql();
  for (const tabla of ['comunidades', 'reel_saves', 'perfil_comunidad_publicaciones', 'perfil_comunidad_respuestas']) {
    assert.ok(esquema.includes('CREATE TABLE public.' + tabla + ' ('));
  }
  assert.match(esquema, /CREATE TRIGGER perfil_comunidad_reel_creado/);
  assert.match(esquema, /CREATE TRIGGER perfil_comunidad_evento_creado/);
  assert.doesNotMatch(sql('actual'), /DROP COLUMN|DROP TABLE[^;]*CASCADE/);
  assert.match(sql('actual'), /IF ocupada THEN[\s\S]*RAISE EXCEPTION[\s\S]*DROP TABLE/);
});

test('la API de comunidad limita adjuntos al contenido propio y respeta bloqueos al responder', () => {
  const controlador = leer('Backend', 'Controllers', 'perfilComunidadController.js');
  const rutas = leer('Backend', 'routes', 'perfilComunidad.js');
  const servidor = leer('Backend', 'index.js');
  const moderacion = leer('Backend', 'services', 'moderationService.js');

  assert.match(controlador, /FROM reels WHERE id = \$1 AND creador_id = \$2/);
  assert.match(controlador, /FROM eventos WHERE id = \$1 AND creador_id = \$2/);
  assert.match(controlador, /FROM user_blocks/);
  assert.doesNotMatch(controlador, /FROM follows/);
  assert.match(controlador, /notificarSeguidores/);
  assert.match(controlador, /notificarMenciones/);
  assert.match(rutas, /crear-publicacion-perfil/);
  assert.match(rutas, /crear-respuesta-perfil/);
  assert.match(servidor, /app\.use\('\/api\/comunidad-perfil', perfilComunidadRoutes\)/);
  assert.match(servidor, /app\.use\('\/api\/comunidades', comunidadesRoutes\)/);
  assert.match(moderacion, /'profile_post'/);
  assert.match(moderacion, /'profile_post_reply'/);
  assert.match(moderacion, /'community_post'/);
  assert.match(moderacion, /'community_comment'/);
});

test('comunidad es la quinta pestana propia y admite publicaciones, adjuntos y respuestas', () => {
  const perfil = leer('Frontend', 'src', 'paginas', 'Miperfil.jsx');
  const otroPerfil = leer('Frontend', 'src', 'paginas', 'OtroPerfil.jsx');
  const componente = leer('Frontend', 'src', 'componentes', 'PerfilComunidad.jsx');
  const app = leer('Frontend', 'src', 'App.jsx');

  const opciones = perfil.match(/\{ id: "(?:publicaciones|eventos|likes|guardados|comunidad)"/g) || [];
  assert.equal(opciones.length, 5);
  assert.match(perfil, /likes: dataPerfil\.likes \|\| \[\]/);
  assert.match(perfil, /reelsPropios=\{contenido\.publicaciones\}/);
  assert.match(perfil, /eventosPropios=\{contenido\.eventos\}/);
  assert.match(otroPerfil, /<PerfilComunidad/);
  assert.match(componente, /\/api\/comunidad-perfil\/\$\{encodeURIComponent\(perfil\.id\)\}/);
  assert.match(componente, /tipoAdjunto === "reel" \? reelsPropios : eventosPropios/);
  assert.match(componente, /opcionesAdjunto\.map/);
  assert.match(componente, /respuestas: agregarRespuesta/);
  assert.match(app, /path="\/comunidad" element=\{<Comunidad usuario=\{usuario\} \/>\}/);
});

test('guardados conserva eventos y previews en API y perfiles', () => {
  const usuarios = leer('Backend', 'Controllers', 'usuarioController.js');
  const reels = leer('Backend', 'Controllers', 'reelController.js');
  const rutas = leer('Backend', 'routes', 'reels.js');
  assert.match(usuarios, /FROM reel_saves/);
  assert.match(usuarios, /reelsGuardados/);
  assert.match(usuarios, /eventosGuardados/);
  assert.match(reels, /alternarGuardado:/);
  assert.match(rutas, /router.post\('\/:id\/guardar'/);
});

test('crear contenido actualiza la comunidad personal y el modulo de foros sigue disponible', () => {
  const creadorReel = leer('Frontend', 'src', 'componentes', 'CrearReelModal.jsx');
  const eventos = leer('Frontend', 'src', 'paginas', 'Eventos.jsx');
  const sidebar = leer('Frontend', 'src', 'componentes', 'SidebarNav.jsx');

  assert.match(creadorReel, /sondar:comunidad-perfil-actualizada/);
  assert.match(eventos, /sondar:comunidad-perfil-actualizada/);
  assert.match(sidebar, /to: "\/comunidad", label: "Foros"/);
  assert.equal(fs.existsSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx')), true);
  assert.equal(fs.existsSync(path.join(raiz, 'Backend', 'Controllers', 'comunidadController.js')), true);
  assert.equal(fs.existsSync(path.join(raiz, 'Backend', 'routes', 'comunidades.js')), true);
});
