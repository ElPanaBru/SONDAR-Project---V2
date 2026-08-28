const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const raiz = path.join(__dirname, '..', '..');
const leer = (...partes) => fs.readFileSync(path.join(raiz, ...partes), 'utf8');

test('la comunidad de perfil convive con foros y elimina solo guardados de reels', () => {
  const sql = leer('Backend', 'BDD-Sql', 'Reemplazar_Foros_Por_Comunidad_Perfil.sql');

  assert.doesNotMatch(sql, /DROP TABLE IF EXISTS public\.comunidades CASCADE/);
  assert.match(sql, /DROP TABLE IF EXISTS public\.reel_saves CASCADE/);
  assert.match(sql, /ALTER TABLE public\.reels DROP COLUMN IF EXISTS guardados/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.perfil_comunidad_publicaciones/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.perfil_comunidad_respuestas/);
  assert.match(sql, /AFTER INSERT ON public\.reels/);
  assert.match(sql, /AFTER INSERT ON public\.eventos/);
  assert.match(sql, /Publico una nueva preview/);
  assert.match(sql, /Creo un nuevo evento/);
  assert.match(sql, /FROM public\.follows f/);
  assert.match(sql, /validar_padre_respuesta_perfil/);
});

test('la API de comunidad limita adjuntos al contenido propio y respuestas a seguidores', () => {
  const controlador = leer('Backend', 'Controllers', 'perfilComunidadController.js');
  const rutas = leer('Backend', 'routes', 'perfilComunidad.js');
  const servidor = leer('Backend', 'index.js');
  const moderacion = leer('Backend', 'services', 'moderationService.js');

  assert.match(controlador, /FROM reels WHERE id = \$1 AND creador_id = \$2/);
  assert.match(controlador, /FROM eventos WHERE id = \$1 AND creador_id = \$2/);
  assert.match(controlador, /FROM follows/);
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

test('guardados queda reservado a eventos en API y reels', () => {
  const usuarios = leer('Backend', 'Controllers', 'usuarioController.js');
  const reelController = leer('Backend', 'Controllers', 'reelController.js');
  const reelRoutes = leer('Backend', 'routes', 'reels.js');
  const descubrir = leer('Frontend', 'src', 'paginas', 'Descubrir.jsx');

  assert.match(usuarios, /guardados: esPropio \? eventosGuardados : \[\]/);
  assert.match(usuarios, /eventos_guardados: \['SELECT \* FROM event_saves/);
  assert.doesNotMatch(usuarios, /reels_guardados|reel_saves/);
  assert.doesNotMatch(reelController, /reel_saves|alternarGuardado/);
  assert.doesNotMatch(reelRoutes, /\/guardar/);
  assert.doesNotMatch(descubrir, /Guardar reel|Quitar de guardados|reel-menu-guardar/);
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
