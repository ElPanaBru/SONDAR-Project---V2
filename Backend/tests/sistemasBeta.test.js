const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('la migracion beta instala mensajeria privada, PostGIS y aprendizaje de escuchas', () => {
  const migration = read('Backend', 'BDD-Sql', 'Sistema_Beta_Mensajeria_Ubicacion_Recomendaciones.sql');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS ubicacion_geog gis\.geography\(Point, 4326\)/);
  assert.match(migration, /USING gist \(ubicacion_geog\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.conversations/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.conversation_members/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.messages/);
  assert.match(migration, /realtime\.broadcast_changes/);
  assert.match(migration, /extension IN \('broadcast', 'presence'\)/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.reel_playback_sessions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_genre_affinity/);
  assert.match(migration, /CREATE TRIGGER reel_playback_actualizar_afinidad/);
});

test('eventos calcula y filtra distancia en PostGIS', () => {
  const controller = read('Backend', 'Controllers', 'eventoController.js');
  const page = read('Frontend', 'src', 'paginas', 'Eventos.jsx');

  assert.match(controller, /gis\.ST_Distance\(/);
  assert.match(controller, /gis\.ST_DWithin\(/);
  assert.match(controller, /req\.query\?\.radioKm/);
  assert.match(page, /Filtrar eventos por distancia/);
  assert.match(page, /parametros\.set\("radioKm", radioKm\)/);
  assert.match(page, /Ubicacion activa/);
});

test('descubrir aprende de escuchas y permite aislar los reels de un perfil', () => {
  const controller = read('Backend', 'Controllers', 'reelController.js');
  const discover = read('Frontend', 'src', 'paginas', 'Descubrir.jsx');
  const ownProfile = read('Frontend', 'src', 'paginas', 'Miperfil.jsx');
  const otherProfile = read('Frontend', 'src', 'paginas', 'OtroPerfil.jsx');

  assert.match(controller, /FROM user_genre_affinity uga/);
  assert.match(controller, /registrarInteraccionEscucha/);
  assert.match(controller, /\$4::uuid IS NULL OR r\.creador_id = \$4::uuid/);
  assert.match(discover, /completionRatio/);
  assert.match(discover, /replayCount/);
  assert.match(discover, /skipped:/);
  assert.match(discover, /parametros\.set\("creador", creadorFiltrado\)/);
  assert.match(ownProfile, /parametros\.set\("creador", item\.creadorId\)/);
  assert.match(otherProfile, /parametros\.set\("creador", item\.creadorId\)/);
});

test('mensajeria integra API, ruta, Realtime, presencia y respaldo por polling', () => {
  const app = read('Frontend', 'src', 'App.jsx');
  const page = read('Frontend', 'src', 'paginas', 'Mensajes.jsx');
  const router = read('Backend', 'routes', 'mensajes.js');
  const controller = read('Backend', 'Controllers', 'mensajeController.js');

  assert.match(app, /path="\/mensajes"/);
  assert.match(router, /conversaciones\/:conversationId\/mensajes/);
  assert.match(router, /mensajes\/:messageId/);
  assert.match(controller, /RATE_MAX_MESSAGES = 8/);
  assert.match(controller, /last_read_at/);
  assert.match(controller, /INTERVAL '15 minutes'/);
  assert.match(page, /private: true/);
  assert.match(page, /event: "typing"/);
  assert.match(page, /event: "sync"/);
  assert.match(page, /window\.setInterval\(\(\) => loadMessages/);
  assert.match(page, /Cargar mensajes anteriores/);
});
