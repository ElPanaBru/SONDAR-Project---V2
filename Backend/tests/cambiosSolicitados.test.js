const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

let miembroActivo = false;
let siguientePublicacionId = 41;
let notificacionesAMiembros = [];
let nivelNotificaciones = 'todas';
let publicacionConLike = false;

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

async function ejecutarQuery(sql, params = []) {
  const consulta = String(sql).replace(/\s+/g, ' ').trim();

  if (consulta.includes('SELECT c.*') && consulta.includes('FROM comunidades c')) {
    const viewerEsMiembro = miembroActivo && params[1] === '11111111-1111-4111-8111-111111111111';
    return resultado([{
      ...comunidadRow,
      unido: viewerEsMiembro,
      miembros: miembroActivo ? 1 : 0,
      nivel_notificaciones: viewerEsMiembro ? nivelNotificaciones : null,
    }]);
  }
  if (consulta.startsWith('UPDATE comunidad_miembros SET nivel_notificaciones')) {
    if (!miembroActivo) return resultado();
    nivelNotificaciones = params[2];
    return resultado([{ comunidad_id: params[0], nivel_notificaciones: nivelNotificaciones }]);
  }
  if (consulta.startsWith('SELECT id, genero, titulo FROM comunidades')) {
    return resultado([{ id: 'pop', genero: 'pop', titulo: 'Pop' }]);
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
          nivelNotificaciones = 'todas';
          return resultado();
        }
        if (consulta.startsWith('DELETE FROM comunidad_miembros')) {
          miembroActivo = false;
          return resultado();
        }
        if (consulta.startsWith('SELECT COUNT(*)::int AS miembros')) {
          return resultado([{ miembros: miembroActivo ? 1 : 0 }]);
        }
        if (consulta.startsWith('SELECT cp.id, cp.user_id')) {
          return resultado([{
            id: 41,
            user_id: usuarioPrueba.id,
            titulo: 'Publicacion relevante',
            comunidad_id: 'pop',
            comunidad_titulo: 'Pop',
          }]);
        }
        if (consulta.startsWith('SELECT 1 FROM comunidad_publicacion_likes')) {
          return resultado(publicacionConLike ? [{ '?column?': 1 }] : []);
        }
        if (consulta.startsWith('INSERT INTO comunidad_publicacion_likes')) {
          publicacionConLike = true;
          return resultado();
        }
        if (consulta.startsWith('DELETE FROM comunidad_publicacion_likes')) {
          publicacionConLike = false;
          return resultado();
        }
        if (consulta.startsWith('SELECT COUNT(*)::int AS likes,')) {
          return resultado([{
            likes: publicacionConLike ? 5 : 4,
            likes_semana: publicacionConLike ? 5 : 4,
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
    return {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      authClient: {
        auth: {
          getUser: async (token) => ({
            data: { user: token === 'token-prueba' ? usuarioPrueba : null },
            error: null,
          }),
        },
      },
    };
  }
  if (request === '../services/notificationService') {
    return {
      crearNotificacion: async () => null,
      eliminarNotificacion: async () => null,
      nombreActor: () => 'Tester',
      notificarMiembrosComunidad: async (datos) => {
        notificacionesAMiembros.push(datos);
        return 1;
      },
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
  assert.deepEqual(ingreso.body, {
    comunidadId: 'pop',
    unido: true,
    miembros: 1,
    nivelNotificaciones: 'todas',
  });

  const salida = crearRespuesta();
  await comunidadController.alternarMembresia(req, salida);
  assert.deepEqual(salida.body, {
    comunidadId: 'pop',
    unido: false,
    miembros: 0,
    nivelNotificaciones: null,
  });
});

test('la membresia se conserva al volver a cargar con la sesion restaurada', async () => {
  miembroActivo = false;
  const reqMembresia = { params: { comunidadId: 'pop' }, user: usuarioPrueba };
  await comunidadController.alternarMembresia(reqMembresia, crearRespuesta());

  const recarga = crearRespuesta();
  await comunidadController.listarComunidades({
    headers: { authorization: 'Bearer token-prueba' },
    query: {},
  }, recarga);

  assert.equal(recarga.statusCode, 200);
  assert.equal(recarga.body[0].unido, true);
  assert.equal(recarga.body[0].miembros, 1);
  assert.equal(recarga.body[0].nivelNotificaciones, 'todas');
});

test('un miembro puede elegir notificaciones relevantes o silenciar la comunidad', async () => {
  miembroActivo = true;
  nivelNotificaciones = 'todas';

  const relevantes = crearRespuesta();
  await comunidadController.actualizarNotificaciones({
    params: { comunidadId: 'pop' },
    user: usuarioPrueba,
    body: { nivel: 'relevantes' },
  }, relevantes);
  assert.deepEqual(relevantes.body, { comunidadId: 'pop', nivelNotificaciones: 'relevantes' });

  const silenciadas = crearRespuesta();
  await comunidadController.actualizarNotificaciones({
    params: { comunidadId: 'pop' },
    user: usuarioPrueba,
    body: { nivel: 'silenciadas' },
  }, silenciadas);
  assert.deepEqual(silenciadas.body, { comunidadId: 'pop', nivelNotificaciones: 'silenciadas' });
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
  notificacionesAMiembros = [];
  const res = crearRespuesta();
  await comunidadController.crearPublicacion({
    params: { comunidadId: 'pop' },
    user: usuarioPrueba,
    body: { titulo: 'Publicacion de prueba', texto: 'Contenido de prueba', tipo: 'reciente' },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.comunidadId, 'pop');
  assert.equal(res.body.titulo, 'Publicacion de prueba');
  assert.equal(notificacionesAMiembros.length, 1);
  assert.equal(notificacionesAMiembros[0].comunidadId, 'pop');
  assert.equal(notificacionesAMiembros[0].type, 'new_community_post');
  assert.match(notificacionesAMiembros[0].targetUrl, /comunidad=pop&publicacion=/);
});

test('el umbral de likes semanal notifica a quienes eligieron contenido relevante', async () => {
  publicacionConLike = false;
  notificacionesAMiembros = [];
  const res = crearRespuesta();

  await comunidadController.alternarLikePublicacion({
    params: { publicacionId: '41' },
    user: usuarioPrueba,
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.likes, 5);
  assert.equal(notificacionesAMiembros.length, 1);
  assert.equal(notificacionesAMiembros[0].nivel, 'relevantes');
  assert.match(notificacionesAMiembros[0].title, /Publicacion relevante/);
});

test('eventos ya no acepta imagenes y usa el icono compacto predeterminado', () => {
  const raiz = path.join(__dirname, '..', '..');
  const rutaEventos = fs.readFileSync(path.join(raiz, 'Backend', 'routes', 'eventos.js'), 'utf8');
  const controladorEventos = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'eventoController.js'), 'utf8');
  const controladorUsuarios = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'usuarioController.js'), 'utf8');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const paginaBuscar = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Buscar.jsx'), 'utf8');
  const icono = path.join(raiz, 'Frontend', 'public', 'sondar-icon.png');

  assert.doesNotMatch(rutaEventos, /multer|upload\.single\(['"]imagen['"]\)/);
  assert.doesNotMatch(controladorEventos, /subirImagenEvento|req\.file/);
  assert.match(paginaEventos, /LOGO_EVENTO_PREDETERMINADO = ["']\/sondar-icon\.png\?v=\d+["']/);
  assert.match(paginaEventos, /const imagenEvento = LOGO_EVENTO_PREDETERMINADO/);
  assert.match(paginaEventos, /iconSize: \[150, 92\]/);
  assert.match(paginaEventos, /iconAnchor: \[75, 46\]/);
  assert.doesNotMatch(paginaEventos, /ICONO_EVENTO_MAPA|evento-pin-sondar\.png/);
  assert.doesNotMatch(paginaEventos, /type=["']file["']/);
  assert.doesNotMatch(paginaEventos, /new FormData\(\)/);
  assert.match(paginaEventos, /body:\s*datosEvento/);
  assert.match(controladorUsuarios, /imagen:\s*["']\/sondar-icon\.png["']/);
  assert.match(paginaBuscar, /img:\s*["']\/sondar-icon\.png\?v=\d+["']/);
  assert.ok(fs.statSync(icono).size > 0);
});

test('los enlaces profundos enfocan eventos y reels sin expandir paneles automaticamente', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const paginaDescubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Descubrir.jsx'), 'utf8');

  assert.match(
    paginaEventos,
    /const seleccionarEventoEnMapa = useCallback\(\(evento, expandir = false\) => \{[\s\S]*?setEventoActivo\(evento\.id\);[\s\S]*?setDetalleExpandido\(expandir\);[\s\S]*?\}, \[\]\);/
  );
  assert.match(
    paginaEventos,
    /eventoCompartidoProcesadoRef\.current = String\(eventoCompartido\);[\s\S]{0,500}?seleccionarEventoEnMapa\(eventoDestino\);/
  );
  assert.doesNotMatch(paginaEventos, /seleccionarEventoEnMapa\(eventoDestino,\s*true\)/);
  assert.match(
    paginaDescubrir,
    /const \[reproduciendo, setReproduciendo\] = useState\(lanzamientoCompartido \|\| null\)/
  );
  assert.match(paginaDescubrir, /const \[comentariosAbiertos, setComentariosAbiertos\] = useState\(null\)/);
  assert.match(
    paginaDescubrir,
    /if \(!lanzamientoCompartido \|\| !comentarioCompartido\) return;[\s\S]{0,300}?setComentariosAbiertos\(lanzamientoCompartido\);/
  );
  assert.match(paginaDescubrir, /const estaSeleccionado = String\(lanzamientoCompartido/);
  assert.match(paginaDescubrir, /estaSeleccionado \? "seleccionado" : ""/);
});

test('las publicaciones usan banderin de guardado y la marca usa el logo raiz versionado', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const navbar = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'Navbar.jsx'), 'utf8');
  const auth = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Auth.jsx'), 'utf8');
  const soporte = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Soporte.jsx'), 'utf8');
  const logo = path.join(raiz, 'Frontend', 'public', 'sondar-logo.png');
  const logoVersionado = /src="\/sondar-logo\.png\?v=\d+"/;

  assert.match(paginaComunidad, /className={`publicacion-guardar/);
  assert.match(paginaComunidad, /M6 3\.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4\.5/);
  assert.match(paginaComunidad, /aria-pressed=\{Boolean\(hilo\.guardado\)\}/);
  assert.match(navbar, logoVersionado);
  assert.match(auth, logoVersionado);
  assert.match(soporte, logoVersionado);
  assert.ok(fs.statSync(logo).size > 0);
});

test('comunidad conserva la estructura, reglas y restricciones solicitadas', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const estilosComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'comunidad.css'), 'utf8');
  const migracion = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Migrar_A_Esquema_Minimo.sql'), 'utf8');
  const encabezado = paginaComunidad.match(/<header className="comunidad-portada">([\s\S]*?)<\/header>/)?.[1] || '';

  assert.match(paginaComunidad, /const reglasForo = \[/);
  assert.match(paginaComunidad, /\{comunidadActiva\.unido \? \([\s\S]*?Crear post[\s\S]*?\) : null\}/);
  assert.doesNotMatch(paginaComunidad, /Unite para publicar/);
  assert.match(paginaComunidad, /Filtrar por:/);
  assert.match(paginaComunidad, /className="comunidad-sidebar subreddit-list"/);
  assert.match(paginaComunidad, /<h2>Foros SONDAR<\/h2>/);
  assert.doesNotMatch(paginaComunidad, /className="comunidad-selector-menu"/);
  assert.ok(paginaComunidad.indexOf('className="comunidad-portada"') < paginaComunidad.indexOf('className="comunidad-main"'));
  assert.doesNotMatch(encabezado, /comunidadActiva\.descripcion|comunidad-miembros/);
  assert.match(paginaComunidad, /className="comunidad-panel comunidad-panel-info"[\s\S]*?comunidadActiva\.descripcion[\s\S]*?className="subreddit-stats"/);
  assert.doesNotMatch(paginaComunidad, /Community highlights/i);
  assert.doesNotMatch(paginaComunidad, /Publicaciones guardadas/i);

  const posicionReglas = paginaComunidad.indexOf('<h2>Reglas del foro</h2>');
  const posicionRecursos = paginaComunidad.indexOf('<h2>Recursos</h2>');
  assert.ok(posicionRecursos > 0 && posicionReglas > posicionRecursos);
  assert.match(estilosComunidad, /\.comunidad-layout\.reddit-layout\s*\{[^}]*--comunidad-desplazamiento:\s*clamp\(88px, 9vw, 160px\);[^}]*grid-template-columns:\s*200px minmax\(0, 1fr\);/s);
  assert.match(estilosComunidad, /\.comunidad-contenido\s*\{[^}]*grid-column:\s*2;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 280px;/s);
  assert.match(estilosComunidad, /\.subreddit-list\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;/s);
  assert.match(estilosComunidad, /\.comunidad-portada\s*\{[^}]*grid-column:\s*1 \/ -1;/s);
  assert.match(estilosComunidad, /\.comunidad-toolbar\s*\{[^}]*margin:\s*0;[^}]*background:\s*transparent;/s);
  assert.match(estilosComunidad, /\.detalle-comunidad\s*\{[^}]*background:\s*#0d0d0d;/s);
  assert.match(estilosComunidad, /\.detalle-comunidad\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior-y:\s*contain;/s);
  assert.match(estilosComunidad, /@media \(max-width: 900px\)[\s\S]*?\.detalle-comunidad\s*\{[^}]*position:\s*static;[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
  assert.match(estilosComunidad, /\.comunidad-reglas\s*\{[^}]*color:\s*rgba\(255,\s*255,\s*255,/s);
  assert.doesNotMatch(estilosComunidad, /@media \(max-width: 900px\)[\s\S]*?\.detalle-comunidad\s*\{\s*display:\s*none;/);
  assert.match(migracion, /CREATE TABLE IF NOT EXISTS public\.comunidad_miembros/);
  assert.doesNotMatch(migracion, /DROP TABLE IF EXISTS public\.comunidad_miembros/);
});

test('comunidades incluye todos los generos vigentes y retira otros', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const controlador = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'comunidadController.js'), 'utf8');
  const migracion = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Actualizar_Comunidades_Generos.sql'), 'utf8');

  for (const genero of ['alternativo', 'punk', 'reggae', 'latina']) {
    assert.match(paginaComunidad, new RegExp(`id: "${genero}"`));
    assert.match(controlador, new RegExp(`id: '${genero}'`));
    assert.match(migracion, new RegExp(`\\('${genero}',`));
  }
  assert.doesNotMatch(paginaComunidad, /id: "otros"/);
  assert.doesNotMatch(controlador, /id: 'otros'/);
  assert.match(controlador, /AND c\.id = ANY\(\$1::text\[\]\)/);
  assert.match(migracion, /SET activa = false[\s\S]*lower\(id\) = 'otros'[\s\S]*lower\(genero\) = 'otros'/);
});

test('los temas asociados de comunidad usan iconos para reproducir y abrir', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const estilosComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'comunidad.css'), 'utf8');
  const html = fs.readFileSync(path.join(raiz, 'Frontend', 'index.html'), 'utf8');

  assert.match(html, /family=Material\+Symbols\+Rounded/);
  assert.match(paginaComunidad, /\? "pause" : "play_arrow"/);
  assert.match(paginaComunidad, /material-symbols-rounded[^>]*>[\s\S]*?link[\s\S]*?<\/span>/);
  assert.doesNotMatch(paginaComunidad, /\? "II" : "Play"/);
  assert.doesNotMatch(paginaComunidad, />\s*Abrir\s*<\/button>/);
  assert.match(estilosComunidad, /\.publicacion-asociada \.asociada-icono-accion\s*\{[^}]*width:\s*34px;[^}]*height:\s*34px;/s);
});

test('comunidad comparte con icono y muestra unicamente los eventos del genero', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const estilosComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'comunidad.css'), 'utf8');

  assert.match(paginaComunidad, /aria-label="Compartir comunidad"/);
  assert.doesNotMatch(paginaComunidad, />\s*Compartir\s*<\/button>/);
  assert.match(paginaComunidad, /aria-controls="recurso-eventos-genero"/);
  assert.match(paginaComunidad, /className="comunidad-recurso-card recurso-evento"/);
  assert.match(paginaComunidad, /\?evento=\$\{encodeURIComponent\(evento\.id\)\}/);
  assert.doesNotMatch(paginaComunidad, /Reels del género|recurso-reels-genero/);
  assert.doesNotMatch(paginaComunidad, /const irARecursoForo/);
  assert.match(estilosComunidad, /\.comunidad-recurso-contenido\s*\{[^}]*max-height:/s);
  assert.match(estilosComunidad, /\.comunidad-recurso-abrir\s*\{[^}]*position:\s*absolute;[^}]*right:/s);
});

test('eventos y comunidades comparten con el mismo modal social', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const paginaComunidad = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Comunidad.jsx'), 'utf8');
  const modal = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'CompartirContenidoModal.jsx'), 'utf8');
  const estilosModal = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'compartirContenidoModal.css'), 'utf8');

  assert.match(paginaEventos, /import CompartirContenidoModal/);
  assert.match(paginaEventos, /titulo="Compartir evento"/);
  assert.doesNotMatch(paginaEventos, /navigator\.share/);
  assert.match(paginaComunidad, /import CompartirContenidoModal/);
  assert.match(paginaComunidad, /titulo="Compartir comunidad"/);
  assert.match(modal, /Copiar[\s\S]*WhatsApp[\s\S]*Facebook[\s\S]*Instagram/);
  assert.match(modal, /https:\/\/wa\.me\/\?text=/);
  assert.match(modal, /facebook\.com\/sharer\/sharer\.php/);
  assert.match(modal, /navigator\.clipboard\?\.writeText/);
  assert.match(modal, /document\.execCommand\("copy"\)/);
  assert.match(estilosModal, /\.compartir-contenido-acciones\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
});

test('descubrir muestra todos los reels sin filtros de busqueda ni genero', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaDescubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Descubrir.jsx'), 'utf8');

  assert.match(paginaDescubrir, /\{lanzamientos\.map\(\(lanzamiento\) =>/);
  assert.doesNotMatch(paginaDescubrir, /searchParams\.get\(["'](?:query|genero)["']\)/);
  assert.doesNotMatch(paginaDescubrir, /filtro-genero-reels|Filtrar reels por género/);
});

test('eventos se crean y muestran sin nombre ni descripcion', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const controlador = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'eventoController.js'), 'utf8');
  const esquema = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Esquema_Minimo_SONDAR.sql'), 'utf8');
  const migracion = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Simplificar_Eventos.sql'), 'utf8');
  const definicionEventos = esquema.match(/CREATE TABLE public\.eventos \(([\s\S]*?)\n\);/)?.[1] || '';

  assert.doesNotMatch(paginaEventos, /name="titulo"|evento-descripcion|nuevoEvento\.(?:titulo|descripcion)/);
  assert.doesNotMatch(paginaEventos, /detalleEvento\.(?:titulo|descripcion)/);
  assert.match(paginaEventos, /<strong>\{detalleEvento\.creador \|\| "Artista SONDAR"\}<\/strong>/);
  assert.doesNotMatch(paginaEventos, /<h2>\{detalleEvento\.creador \|\| "Artista SONDAR"\}<\/h2>/);
  assert.match(paginaEventos, /className="evento-sheet-eyebrow">EVENTO<\/span>[\s\S]*?className="evento-sheet-meta"[\s\S]*?nombre="ubicacion"[\s\S]*?aria-hidden="true">-<\/i>[\s\S]*?nombre="calendario"[\s\S]*?<time/);
  assert.match(paginaEventos, /className="evento-sheet-organizadores">\s*<span>MÚSICOS<\/span>/);
  assert.doesNotMatch(paginaEventos, /<span>MÚSICO<\/span>|<span>INVITADOS<\/span>/);
  assert.doesNotMatch(paginaEventos, /<strong>\{mostrarGenero\(detalleEvento\.genero\)\}<\/strong>/);
  assert.match(controlador, /\} = normalizarDatosEvento\(req\.body\);/);
  assert.match(controlador, /body\.ubicacion, body\.lugar/);
  assert.match(controlador, /body\.latitud, body\.lat/);
  assert.match(controlador, /body\.longitud, body\.lng/);
  assert.match(controlador, /delete resultado\.titulo;\s*delete resultado\.descripcion;/);
  assert.match(controlador, /INSERT INTO eventos \(genero, lugar, fecha, precio, link, creador_id, latitud, longitud\)/);
  assert.doesNotMatch(controlador, /INSERT INTO eventos \((?:[^)]*,\s*)?(?:titulo|descripcion)/);
  assert.doesNotMatch(controlador, /ALTER TABLE public\.eventos/);
  assert.doesNotMatch(definicionEventos, /\b(?:titulo|descripcion)\s+text/);
  assert.match(migracion, /ALTER COLUMN titulo DROP NOT NULL/);
  assert.match(migracion, /ALTER COLUMN descripcion DROP NOT NULL/);
  assert.match(migracion, /ALTER COLUMN descripcion DROP DEFAULT/);
});

test('eventos reproduce reels asociados en filas compactas sin abrir una muestra completa', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const estilosEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'eventos.css'), 'utf8');
  const reglasBarraPreview = estilosEventos.match(/\.evento-preview-item::after\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(paginaEventos, /className="evento-preview-lista" role="list"/);
  assert.match(paginaEventos, /className={`evento-preview-item \$\{esReelActivo \? "reproduciendo" : ""\}`}/);
  assert.match(paginaEventos, /className="evento-preview-accion"/);
  assert.match(paginaEventos, /function IndicadorPreviewReel\(\{ portada, reproduciendo \}\)/);
  assert.match(paginaEventos, /<img src=\{portada\} alt="" onError=\{\(\) => setPortadaFallida\(true\)\} \/>/);
  assert.match(paginaEventos, /portada=\{reel\.portada\}/);
  assert.match(paginaEventos, /aria-pressed=\{esReelActivo\}/);
  assert.match(paginaEventos, /className="evento-preview-ecualizador"><i \/><i \/><i \/><\/span>/);
  assert.match(paginaEventos, /onPause=\{\(event\) => \{[\s\S]*?event\.currentTarget\.paused[\s\S]*?setReelActivo\(null\)/);
  assert.match(paginaEventos, /onError=\{\(\) => \{[\s\S]*?setReelActivo\(null\)/);
  assert.match(paginaEventos, /filaPreview\.style\.setProperty\("--preview-progreso", String\(progreso\)\)/);
  assert.match(paginaEventos, /window\.requestAnimationFrame\(animarProgreso\)/);
  assert.match(paginaEventos, /audio\.addEventListener\("timeupdate", actualizarProgreso\)/);
  assert.doesNotMatch(paginaEventos, /setTiempoPreview|setDuracionPreview/);
  assert.doesNotMatch(paginaEventos, /className="evento-preview-reproductor"/);
  assert.doesNotMatch(paginaEventos, /previewSeleccionadaId|cambiarPreview|cambiarTiempoPreview/);
  assert.match(estilosEventos, /\.evento-preview-item\s*\{[^}]*grid-template-columns:\s*38px minmax\(0, 1fr\) 44px;/s);
  assert.match(estilosEventos, /\.evento-preview-accion\s*\{[^}]*width:\s*44px;[^}]*border-radius:\s*50%;/s);
  assert.match(estilosEventos, /\.evento-preview-indicador\.con-portada img\s*\{[^}]*object-fit:\s*cover;[^}]*object-position:\s*center;/s);
  assert.match(reglasBarraPreview, /transition:\s*opacity 0\.18s ease/);
  assert.doesNotMatch(reglasBarraPreview, /transition:[^;]*transform/);
  assert.match(estilosEventos, /\.evento-preview-item\.reproduciendo::after\s*\{[^}]*will-change:\s*transform;/s);
  assert.match(estilosEventos, /@keyframes evento-preview-pulso/);
  assert.match(estilosEventos, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.evento-preview-ecualizador i/s);
});

test('el genero del detalle de eventos usa texto negro sobre fondo naranja', () => {
  const raiz = path.join(__dirname, '..', '..');
  const estilosEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'eventos.css'), 'utf8');

  assert.match(
    estilosEventos,
    /\.evento-sheet-titulo \.evento-sheet-genero\s*\{[^}]*color:\s*#080808;[^}]*background:\s*linear-gradient\(90deg, #ffae00, #ff5e00\);[^}]*font-weight:\s*800;/s
  );
});

test('eventos admite hasta tres generos y la migracion agrega solo los solicitados', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const controlador = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'eventoController.js'), 'utf8');
  const migracion = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Agregar_Multiples_Generos_Eventos.sql'), 'utf8');

  assert.match(paginaEventos, /const MAX_GENEROS_EVENTO = 3/);
  assert.match(paginaEventos, /generos: nuevoEvento\.generos/);
  assert.match(controlador, /INSERT INTO evento_generos \(event_id, genero, posicion\)/);
  assert.match(migracion, /CREATE TABLE IF NOT EXISTS public\.evento_generos/);
  assert.match(migracion, /CHECK \(posicion BETWEEN 1 AND 3\)/);
  for (const genero of ['alternativo', 'punk', 'reggae', 'latina']) {
    assert.match(migracion, new RegExp(`\\('${genero}',`));
  }
  assert.doesNotMatch(migracion, /\('tango',|\('funk',/);
});

test('los filtros de genero se pueden desplazar sin quedar cortados', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const estilosEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'eventos.css'), 'utf8');
  const reglasFiltros = estilosEventos.match(/\.eventos-explorador-generos\s*\{([^}]*)\}/)?.[1] || '';

  assert.equal((paginaEventos.match(/onWheel=\{desplazarFiltrosConRueda\}/g) || []).length, 2);
  assert.match(reglasFiltros, /min-width:\s*0/);
  assert.match(reglasFiltros, /max-width:\s*100%/);
  assert.match(reglasFiltros, /overflow-x:\s*auto/);
  assert.match(reglasFiltros, /scrollbar-width:\s*thin/);
  assert.match(reglasFiltros, /touch-action:\s*pan-x/);
  assert.doesNotMatch(estilosEventos, /\.eventos-(?:explorador-generos|sheet-tags)::\-webkit-scrollbar\s*\{[^}]*display:\s*none/s);
});

test('el explorador de eventos se pliega y deja visible su tirador', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Eventos.jsx'), 'utf8');
  const estilosEventos = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'eventos.css'), 'utf8');

  assert.match(paginaEventos, /const \[exploradorPlegado, setExploradorPlegado\] = useState\(false\)/);
  assert.match(paginaEventos, /className="eventos-explorador-handle"[\s\S]*?aria-expanded=\{!exploradorPlegado\}/);
  assert.match(paginaEventos, /setExploradorPlegado\(\(actual\) => !actual\)/);
  assert.match(estilosEventos, /\.eventos-explorador\.plegado\s*\{[^}]*width:\s*132px;[^}]*max-height:\s*24px;/s);
  assert.match(estilosEventos, /\.eventos-explorador\.plegado \.eventos-explorador-contenido\s*\{[^}]*visibility:\s*hidden;/s);
  assert.match(estilosEventos, /\.evento-sheet-meta span\s*\{[^}]*flex-wrap:\s*nowrap;/s);
});

test('el creador global de reels conserva la pagina y pide solo titulo genero portada y audio', () => {
  const raiz = path.join(__dirname, '..', '..');
  const navbar = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'Navbar.jsx'), 'utf8');
  const app = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'App.jsx'), 'utf8');
  const creador = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'CrearReelModal.jsx'), 'utf8');

  assert.match(navbar, /onCrearReel\(\)/);
  assert.doesNotMatch(navbar, /navigate\("\/descubrir\?crear=reel"\)/);
  assert.match(app, /<CrearReelModal/);
  assert.match(creador, /formData\.append\("titulo"/);
  assert.match(creador, /formData\.append\("genero"/);
  assert.match(creador, /formData\.append\("audio"/);
  assert.match(creador, /formData\.append\("portada"/);
  assert.doesNotMatch(creador, /formData\.append\("(?:album|descripcion)"/);
  assert.doesNotMatch(creador, /Nombre del reel|Descripcion/);
});

test('reels muestra portada cuadrada, pie superpuesto, creador y acciones laterales', () => {
  const raiz = path.join(__dirname, '..', '..');
  const paginaDescubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Descubrir.jsx'), 'utf8');
  const estilosDescubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'descubrir.css'), 'utf8');

  assert.match(paginaDescubrir, /className="album-imagen"/);
  assert.match(paginaDescubrir, /className="reel-info-inferior"/);
  assert.match(paginaDescubrir, /className="reel-titulo"/);
  assert.match(paginaDescubrir, /className="reel-identidad"/);
  assert.match(paginaDescubrir, /className=\{`artista-avatar \$\{lanzamiento\.avatar \? "" : "sin-avatar"\}`\}/);
  assert.match(paginaDescubrir, /aria-pressed=\{lanzamiento\.siguiendo\}/);
  assert.match(paginaDescubrir, /disabled=\{seguimientosPendientes\.has\(lanzamiento\.creadorId\)\}/);
  assert.match(paginaDescubrir, /className="acciones-laterales"/);
  assert.doesNotMatch(paginaDescubrir, /className="reel-menu-guardar"/);
  assert.doesNotMatch(paginaDescubrir, /Guardar reel|Quitar de guardados/);
  assert.match(paginaDescubrir, /Denunciar publicacion/);
  assert.doesNotMatch(
    paginaDescubrir,
    /className="reel-portada-fondo"|className="reel-player"|className="feed-fondo-portada"|className="reel-progress"/
  );
  assert.doesNotMatch(paginaDescubrir, /setProgresos|--progreso/);
  assert.doesNotMatch(estilosDescubrir, /\.reel-progress/);
  assert.ok(paginaDescubrir.indexOf('className="album-imagen"') < paginaDescubrir.indexOf('className="reel-info-inferior"'));
  assert.ok(paginaDescubrir.indexOf('className="reel-titulo"') < paginaDescubrir.indexOf('className="reel-identidad"'));
  assert.match(estilosDescubrir, /Composicion final:[\s\S]*?\.descubrir-feed \.album-portada\s*\{[^}]*aspect-ratio:\s*1;/s);
  assert.match(
    estilosDescubrir,
    /Composicion final:[\s\S]*?\.acciones-laterales\s*\{[^}]*position:\s*absolute;[^}]*top:\s*50%;[^}]*left:\s*calc\(100% \+ 12px\);/s
  );
  assert.match(
    estilosDescubrir,
    /Composicion final:[\s\S]*?\.reel-info-inferior,[\s\S]*?\{[^}]*position:\s*absolute;[^}]*top:\s*auto;[^}]*bottom:\s*0;[^}]*background:\s*linear-gradient/s
  );
  assert.match(estilosDescubrir, /\.reel-info-inferior \.artista-avatar\.sin-avatar\s*\{[^}]*#[fF]{2}[cC]247[^}]*#[fF]{2}9200/);
});

test('reels usa un fondo dominante estatico y funde solo al cambiar el reel visible', () => {
  const raiz = path.join(__dirname, '..', '..');
  const creador = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'componentes', 'CrearReelModal.jsx'), 'utf8');
  const paginaDescubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'Descubrir.jsx'), 'utf8');
  const estilosDescubrir = fs.readFileSync(path.join(raiz, 'Frontend', 'src', 'paginas', 'descubrir.css'), 'utf8');
  const controlador = fs.readFileSync(path.join(raiz, 'Backend', 'Controllers', 'reelController.js'), 'utf8');
  const esquema = fs.readFileSync(path.join(raiz, 'Backend', 'BDD-Sql', 'Crear_Reels.sql'), 'utf8');

  assert.match(creador, /extraerColorDominante\(archivo\)/);
  assert.match(creador, /const versionSeleccionPortadaRef = useRef\(0\)/);
  assert.match(creador, /const versionSeleccion = \+\+versionSeleccionPortadaRef\.current/);
  assert.match(creador, /if \(versionSeleccion !== versionSeleccionPortadaRef\.current\) return;/);
  assert.match(creador, /limpiarPortada = \(\) => \{\s*versionSeleccionPortadaRef\.current \+= 1;/);
  assert.match(creador, /type="color"/);
  assert.match(creador, /formData\.append\("color_principal"/);
  assert.match(paginaDescubrir, /extraerColorDominanteDesdeUrl/);
  assert.match(paginaDescubrir, /slice\(indiceColorActivo, indiceColorActivo \+ 2\)/);
  assert.match(paginaDescubrir, /new AbortController\(\)/);
  assert.match(paginaDescubrir, /const \[capasFondoReel, setCapasFondoReel\] = useState/);
  assert.match(paginaDescubrir, /className="reel-fondos-globales"/);
  assert.match(paginaDescubrir, /className=\{`reel-fondo-global/);
  assert.match(paginaDescubrir, /if \(esElMismoReel\) return;/);
  assert.match(paginaDescubrir, /setIndiceFondoReelActivo\(siguienteIndice\)/);
  assert.match(paginaDescubrir, /candidato\.ratio >= 0\.56/);
  assert.match(paginaDescubrir, /candidato\.ratio - ratioActual >= 0\.12/);
  assert.match(paginaDescubrir, /"--tono-principal": colorPrincipal/);
  assert.match(paginaDescubrir, /"--tono-b": mezclarColores\(colorPrincipal, "#17171a", 0\.46\)/);
  assert.match(paginaDescubrir, /"--tono-c": mezclarColores\(colorPrincipal, "#121216", 0\.68\)/);
  assert.match(
    estilosDescubrir,
    /\.reel-fondo-global\s*\{[^}]*position:\s*absolute;[\s\S]*?radial-gradient[\s\S]*?linear-gradient[\s\S]*?transition:\s*opacity 0\.42s/s
  );
  assert.match(
    estilosDescubrir,
    /\.reel-fondo-global::after\s*\{[^}]*radial-gradient\(ellipse at center[\s\S]*?linear-gradient/s
  );
  assert.match(estilosDescubrir, /ellipse at 50% 36%/);
  assert.match(
    estilosDescubrir,
    /circle at 10% 72%,\s*color-mix\(in srgb, var\(--fondo-reel-medio, #8c6710\) 78%, #17171e 22%\)[\s\S]*?circle at 90% 72%,\s*color-mix\(in srgb, var\(--fondo-reel-medio, #8c6710\) 78%, #17171e 22%\)/s
  );
  assert.match(estilosDescubrir, /linear-gradient\(\s*180deg,/s);
  assert.match(
    estilosDescubrir,
    /circle at 28% 24%, rgba\(255, 255, 255, 0\.04\)[\s\S]*?circle at 72% 24%, rgba\(255, 255, 255, 0\.04\)/s
  );
  assert.match(estilosDescubrir, /\.descubrir-feed \.feed-item\s*\{[^}]*background:\s*transparent;/s);
  assert.doesNotMatch(estilosDescubrir, /\.reel-fondo-global\s*\{[^}]*filter:/s);
  assert.doesNotMatch(estilosDescubrir, /@keyframes revelar-fondo-reel/);
  assert.doesNotMatch(estilosDescubrir, /@keyframes reelEntraSuave/);
  assert.doesNotMatch(estilosDescubrir, /--fondo-reel-opacidad/);
  assert.doesNotMatch(paginaDescubrir, /color-portada-(?:pendiente|revelada)/);
  assert.match(controlador, /PATRON_COLOR_HEX_COMPLETO\s*=\s*\/\^#\[0-9a-fA-F\]\{6\}\$\//);
  assert.match(controlador, /color_principal/);
  assert.match(esquema, /color_principal\s+TEXT/i);
});
