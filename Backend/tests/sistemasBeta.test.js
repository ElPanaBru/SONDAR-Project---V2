const { sql } = require('./helpers/sql');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('la migracion beta instala mensajeria privada, PostGIS y aprendizaje de escuchas', () => {
  const migration = sql();

  assert.match(migration, /ubicacion_geog\s+gis\.geography\(Point,\s*4326\)/);
  assert.match(migration, /USING gist \(ubicacion_geog\)/);
  assert.match(migration, /CREATE TABLE public\.conversations/);
  assert.match(migration, /CREATE TABLE public\.conversation_members/);
  assert.match(migration, /CREATE TABLE public\.messages/);
  assert.match(migration, /realtime\.broadcast_changes/);
  assert.match(migration, /extension[\s\S]{0,100}broadcast[\s\S]{0,100}presence/);
  assert.match(migration, /CREATE TABLE public\.reel_playback_sessions/);
  assert.match(migration, /CREATE TABLE public\.user_genre_affinity/);
  assert.match(migration, /CREATE TRIGGER reel_playback_actualizar_afinidad/);
});

test('eventos calcula y filtra distancia en PostGIS', () => {
  const controller = read('Backend', 'Controllers', 'eventoController.js');
  const page = read('Frontend', 'src', 'paginas', 'Eventos.jsx');

  assert.match(controller, /gis\.ST_Distance\(/);
  assert.match(controller, /gis\.ST_DWithin\(/);
  assert.match(controller, /req\.query\?\.radioKm/);
  assert.match(page, /mostrarPrecioYDistancia/);
  assert.match(page, /distancia_km/);
});

test('eventos usa tiles sin API key y conserva el mapa principal oscuro', () => {
  const page = read('Frontend', 'src', 'paginas', 'Eventos.jsx');
  const styles = read('Frontend', 'src', 'paginas', 'eventos.css');

  assert.match(page, /https:\/\/tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/);
  assert.match(page, /https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(page, /maplibreGL\(\{/);
  assert.match(page, /maplibre-gl-worker\.mjs\?worker&url/);
  assert.match(page, /setWorkerUrl\(maplibreWorkerUrl\)/);
  assert.match(page, /sondarStyleVersion = VERSION_CAPA_MAPA/);
  assert.match(page, /OpenFreeMap<\/a>/);
  assert.match(page, /OpenStreetMap<\/a> contributors/);
  assert.doesNotMatch(page, /basemaps\.cartocdn\.com|carto\.com\/basemaps\/apikey/i);
  assert.equal((page.match(/attributionControl: true/g) || []).length, 2);
  assert.match(page, /typeof capa\.getMaplibreMap === "function"/);
  assert.match(page, /classList\.toggle\("mapa-dark-matter"/);
  assert.doesNotMatch(styles, /\.eventos-mapa[^}]*\.leaflet-tile[^}]*invert\(1\)/s);
  assert.match(styles, /\.eventos-container \.leaflet-bottom\.leaflet-right,[\s\S]{0,180}?bottom:\s*0;/);
  assert.match(styles, /\.eventos-mapa \.leaflet-control-attribution\s*\{[^}]*font-size:\s*10px;/s);
});

test('el mapa del creador queda fijo mientras se desplazan los campos', () => {
  const page = read('Frontend', 'src', 'paginas', 'Eventos.jsx');
  const styles = read('Frontend', 'src', 'paginas', 'eventos.css');

  assert.match(page, /scrollWheelZoom: false/);
  assert.match(page, /className="evento-modal-mapa-fijo"[\s\S]*?className="evento-modal-campos-scroll"/);
  assert.match(styles, /\.evento-modal \.evento-modal-form\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.evento-modal-mapa-fijo > \.evento-minimapa\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.match(styles, /\.evento-modal-campos-scroll\s*\{[^}]*overflow-y:\s*auto;/s);
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
  const migration = sql();

  assert.match(app, /path="\/mensajes"/);
  assert.match(router, /conversaciones\/:conversationId\/mensajes/);
  assert.match(router, /mensajes\/:messageId/);
  assert.match(controller, /RATE_MAX_MESSAGES = 8/);
  assert.match(controller, /last_read_at/);
  assert.match(controller, /last_delivered_at/);
  assert.match(controller, /INTERVAL '15 minutes'/);
  assert.match(page, /private: true/);
  assert.match(page, /event: "typing"/);
  assert.match(page, /event: "sync"/);
  assert.match(page, /event: "delivered"/);
  assert.match(page, /◷ Enviando/);
  assert.match(page, /✓✓ Recibido/);
  assert.match(page, /✓✓ Leído/);
  assert.match(page, /El usuario ya no existe/);
  assert.match(page, /window\.setInterval\(\(\) => loadMessages/);
  assert.match(page, /Cargar mensajes anteriores/);
  assert.doesNotMatch(migration, /ADD CONSTRAINT conversation_members_user_id_fkey/);
  assert.match(migration, /ADD CONSTRAINT messages_sender_id_fkey/);
  const messages = migration.match(/CREATE TABLE public.messages \(([\s\S]*?)\n\);/)?.[1] || '';
  assert.doesNotMatch(messages, /sender_id[^\n]*NOT NULL/);
  assert.match(migration, /FOREIGN KEY \(sender_id\) REFERENCES public\.users\(id\) ON DELETE SET NULL/);
  assert.match(migration, /last_delivered_at/);
});

test('mensajes se integra con notificaciones sin indicador en la barra lateral', () => {
  const controller = read('Backend', 'Controllers', 'mensajeController.js');
  const service = read('Backend', 'services', 'notificationService.js');
  const server = read('Backend', 'index.js');
  const schema = read('Backend', 'services', 'settingsSchema.js');
  const settings = read('Frontend', 'src', 'paginas', 'Configuracion.jsx');
  const sidebar = read('Frontend', 'src', 'componentes', 'SidebarNav.jsx');

  assert.match(controller, /type: 'direct_message'/);
  assert.match(service, /direct_message: 'notificar_mensajes'/);
  assert.match(server, /'PATCH'/);
  assert.match(schema, /ADD COLUMN IF NOT EXISTS notificar_mensajes/);
  assert.match(settings, /name="notificarMensajes"/);
  assert.match(sidebar, /label: "Preview"/);
  assert.doesNotMatch(sidebar, /noLeidos|badge|notification-dot|mensajes-actualizados/);
});

test('el borrado de previews elimina portada y audio antes de confirmar la base', () => {
  const controller = read('Backend', 'Controllers', 'reelController.js');
  const storage = read('Backend', 'services', 'storageService.js');
  const cleanup = read('Backend', 'scripts', 'limpiarStorageHuerfano.js');

  assert.match(controller, /RETURNING id, portada_path, portada_url, audio_path, audio_url/);
  assert.match(controller, /extraerRutaPublica\(reel\.portada_url, REELS_BUCKET\)/);
  assert.match(controller, /await Promise\.all\(\[/);
  assert.match(controller, /await client\.query\('COMMIT'\)/);
  assert.doesNotMatch(controller, /eliminarArchivoReel\(result\.rows\[0\]\.portada_path[^\n]*catch/);
  assert.match(storage, /storageParaEliminar\(accessToken\)[\s\S]*?\.from\(REELS_BUCKET\)[\s\S]*?\.remove/);
  assert.match(cleanup, /FROM storage\.objects/);
  assert.match(cleanup, /SUPABASE_STORAGE_ACCESS_TOKEN/);
});
