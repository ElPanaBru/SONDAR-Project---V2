const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Frontend', '.env') });

const API = process.env.TEST_API_URL || 'http://127.0.0.1:3000/api';
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const password = 'CodexTest!2026';
const accounts = [
  { email: `codex_a_${suffix}@example.com`, username: `codex_a_${suffix}`.slice(0, 30) },
  { email: `codex_b_${suffix}@example.com`, username: `codex_b_${suffix}`.slice(0, 30) },
];

const results = [];
const state = { tokens: [], users: [], reelId: null, eventId: null };

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function request(pathname, { token, expected = 200, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API}${pathname}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (response.status !== expected) {
    throw new Error(`${options.method || 'GET'} ${pathname}: ${response.status}, esperado ${expected}: ${text.slice(0, 300)}`);
  }
  return data;
}

async function signIn(email) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`No se pudo iniciar sesion temporal: ${data.error_description || data.msg}`);
  return data.access_token;
}

async function step(name, action) {
  try {
    const value = await action();
    record(name, true);
    return value;
  } catch (error) {
    record(name, false, error.message);
    throw error;
  }
}

async function creacionDoble(action) {
  const [primera, segunda] = await Promise.all([action(), action()]);
  const primerId = primera?.backendId || primera?.id;
  const segundoId = segunda?.backendId || segunda?.id;
  if (!primerId || String(primerId) !== String(segundoId)) {
    throw new Error(`Se crearon registros duplicados: ${primerId || 'sin id'} y ${segundoId || 'sin id'}`);
  }
  return primera;
}

async function cleanup() {
  if (state.tokens[0] && state.reelId) {
    await request(`/reels/${state.reelId}`, { method: 'DELETE', token: state.tokens[0] }).catch(() => null);
  }
  if (state.tokens[0] && state.eventId) {
    await request(`/eventos/${state.eventId}`, { method: 'DELETE', token: state.tokens[0] }).catch(() => null);
  }
  for (const token of state.tokens) {
    await request('/usuarios/me', { method: 'DELETE', token, body: { password } }).catch(() => null);
  }
}

async function main() {
  try {
    await step('Health', () => request('/health'));
    await step('Proteccion sin token', () => request('/usuarios/me', { expected: 401 }));
    await step('Listado de reels', () => request('/reels'));
    await step('Listado de eventos', () => request('/eventos'));
    const communities = await step('Listado de comunidades', () => request('/comunidades'));
    if (!Array.isArray(communities) || communities.length === 0) throw new Error('No hay comunidades');

    for (const account of accounts) {
      const created = await step(`Crear cuenta ${account.username}`, () => request('/usuarios/crear-cuenta', {
        method: 'POST',
        body: { ...account, password, user_type: 'musico' },
        expected: 201,
      }));
      state.users.push(created);
      state.tokens.push(await step(`Login ${account.username}`, () => signIn(account.email)));
    }

    const [tokenA, tokenB] = state.tokens;
    const [userA, userB] = state.users;

    const onboardingForm = new FormData();
    onboardingForm.append('birthDate', '2000-01-01');
    onboardingForm.append('genres', JSON.stringify(['pop', 'rock', 'jazz']));
    onboardingForm.append(
      'avatar',
      new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }),
      'avatar.png'
    );
    await step('Completar onboarding con fecha y foto', () => request('/usuarios/me/onboarding', {
      method: 'PUT', token: tokenA, body: onboardingForm,
    }));
    await step('Recomendaciones por generos en Descubrir', () => request('/reels', { token: tokenA }));

    await step('Verificar usuario autenticado', () => request('/usuarios/me', { token: tokenA }));
    await step('Actualizar configuracion unificada', () => request('/usuarios/me/configuracion', {
      method: 'PUT', token: tokenA,
      body: {
        telefono: '1155550000', codigoPais: '+54', idioma: 'es', actividadCuenta: true,
        notificarInteracciones: true, notificarComentarios: true, notificarSeguidores: true,
        notificarPublicaciones: true, notificarMenciones: true, reducirMovimiento: false,
        mostrarEmail: false,
      },
    }));
    await step('Leer configuracion', () => request('/usuarios/me/configuracion', { token: tokenA }));

    const profileForm = new FormData();
    profileForm.append('nombre', 'Codex Prueba A');
    profileForm.append('bio', 'Perfil temporal de prueba integral.');
    await step('Actualizar perfil minimo', () => request('/usuarios/me/perfil', {
      method: 'PUT', token: tokenA, body: profileForm,
    }));
    await step('Buscar usuario', () => request(`/usuarios?query=${encodeURIComponent(accounts[0].username)}`));
    await step('Perfil publico', () => request(`/usuarios/${userB.id}/perfil`, { token: tokenA }));

    await step('Seguir usuario', () => request(`/usuarios/${userB.id}/seguir`, { method: 'POST', token: tokenA }));
    await step('Listar seguidos', () => request('/usuarios/me/seguidos', { token: tokenA }));
    await step('Silenciar notificaciones', () => request(`/usuarios/${userB.id}/silenciar-notificaciones`, { method: 'POST', token: tokenA }));
    await step('Reactivar notificaciones', () => request(`/usuarios/${userB.id}/silenciar-notificaciones`, { method: 'POST', token: tokenA }));

    const post = await step('Evitar publicacion de comunidad duplicada', () => creacionDoble(() => request('/comunidades/pop/publicaciones', {
      method: 'POST', token: tokenA, headers: { 'Idempotency-Key': `post-${suffix}` },
      body: { titulo: 'Prueba integral temporal', texto: `Hola @${accounts[1].username}`, tipo: 'reciente', etiqueta: 'test' }, expected: 201,
    })));
    await step('Like de publicacion', () => request(`/comunidades/publicaciones/${post.id}/like`, { method: 'POST', token: tokenB }));
    await step('Guardar publicacion', () => request(`/comunidades/publicaciones/${post.id}/guardar`, { method: 'POST', token: tokenB }));
    const communityComment = await step('Evitar comentario comunitario duplicado', () => creacionDoble(() => request(`/comunidades/publicaciones/${post.id}/comentarios`, {
      method: 'POST', token: tokenB, headers: { 'Idempotency-Key': `community-comment-${suffix}` },
      body: { texto: 'Comentario temporal' }, expected: 201,
    })));
    await step('Like de comentario comunitario', () => request(`/comunidades/comentarios/${communityComment.id}/like`, { method: 'POST', token: tokenA }));
    await step('Leer publicaciones y metricas', () => request('/comunidades/pop/publicaciones'));

    const crearReelForm = () => {
      const reelForm = new FormData();
      reelForm.append('tema', 'Reel temporal Codex');
      reelForm.append('album', 'Pruebas');
      reelForm.append('genero', 'pop');
      reelForm.append('descripcion', `Reel temporal para @${accounts[1].username}`);
      reelForm.append('duracion', '0:01');
      reelForm.append('audio', new Blob([Buffer.from('RIFF0000WAVEfmt ')], { type: 'audio/wav' }), 'test.wav');
      return reelForm;
    };
    const reel = await step('Evitar reel duplicado con Storage', () => creacionDoble(() => request('/reels/crear', {
      method: 'POST', token: tokenA, headers: { 'Idempotency-Key': `reel-${suffix}` },
      body: crearReelForm(), expected: 201,
    })));
    state.reelId = reel.backendId || reel.id;
    await step('Registrar visita unica', () => request(`/reels/${state.reelId}/visita`, { method: 'POST', token: tokenB }));
    await step('Like de reel', () => request(`/reels/${state.reelId}/like`, { method: 'POST', token: tokenB }));
    await step('Guardar reel', () => request(`/reels/${state.reelId}/guardar`, { method: 'POST', token: tokenB }));
    await step('Compartir reel', () => request(`/reels/${state.reelId}/compartir`, { method: 'POST', token: tokenB }));
    const reelComment = await step('Evitar comentario de reel duplicado', () => creacionDoble(() => request(`/reels/${state.reelId}/comentarios`, {
      method: 'POST', token: tokenB, headers: { 'Idempotency-Key': `reel-comment-${suffix}` },
      body: { texto: 'Comentario de reel temporal' }, expected: 201,
    })));
    await step('Like de comentario de reel', () => request(`/reels/comentarios/${reelComment.id}/like`, { method: 'POST', token: tokenA }));
    await step('Leer comentarios del reel', () => request(`/reels/${state.reelId}/comentarios`));
    await step('Eliminar comentario del reel', () => request(`/reels/comentarios/${reelComment.id}`, { method: 'DELETE', token: tokenB }));

    const fechaEventoPrueba = new Date(Date.now() + 86400000).toISOString();
    const crearEventoForm = () => {
      const eventForm = new FormData();
      eventForm.append('titulo', 'Evento temporal Codex');
      eventForm.append('descripcion', 'Evento de prueba integral');
      eventForm.append('genero', 'pop');
      eventForm.append('ubicacion', 'Buenos Aires');
      eventForm.append('fecha', fechaEventoPrueba);
      eventForm.append('precio', '0');
      eventForm.append('latitud', '-34.6037');
      eventForm.append('longitud', '-58.3816');
      eventForm.append('organizadores', JSON.stringify([userB.id]));
      return eventForm;
    };
    const event = await step('Evitar evento duplicado con coorganizador', () => creacionDoble(() => request('/eventos/crear', {
      method: 'POST', token: tokenA, headers: { 'Idempotency-Key': `event-${suffix}` },
      body: crearEventoForm(), expected: 201,
    })));
    state.eventId = event.id;
    await step('Guardar evento', () => request(`/eventos/${state.eventId}/guardar`, { method: 'POST', token: tokenB }));

    await step('Denunciar perfil temporal', () => request(`/usuarios/${userB.id}/denunciar`, {
      method: 'POST', token: tokenA, body: { reason: 'otro', detail: 'Prueba temporal automatizada' },
    }));
    const notifications = await step('Listar notificaciones', () => request('/notificaciones?limit=50', { token: tokenB }));
    if (notifications.items?.[0]) {
      await step('Marcar notificacion leida', () => request(`/notificaciones/${notifications.items[0].id}/leer`, { method: 'POST', token: tokenB }));
    }
    await step('Contar no leidas', () => request('/notificaciones/no-leidas', { token: tokenB }));
    await step('Marcar todas leidas', () => request('/notificaciones/leer-todas', { method: 'POST', token: tokenB }));
    await step('Eliminar notificaciones leidas', () => request('/notificaciones/leidas', { method: 'DELETE', token: tokenB }));
    await step('Exportar datos', () => request('/usuarios/me/exportar', { token: tokenA }));
    await step('Rechazar eliminacion con contrasena incorrecta', () => request('/usuarios/me', {
      method: 'DELETE', token: tokenA, body: { password: 'ContrasenaIncorrecta!2026' }, expected: 401,
    }));
    await step('Conservar cuenta tras contrasena incorrecta', () => request('/usuarios/me', { token: tokenA }));

    await step('Bloquear usuario', () => request(`/usuarios/${userB.id}/bloquear`, { method: 'POST', token: tokenA }));
    await step('Listar bloqueados', () => request('/usuarios/me/bloqueados', { token: tokenA }));
    await step('Desbloquear usuario', () => request(`/usuarios/${userB.id}/bloquear`, { method: 'DELETE', token: tokenA }));

    await step('Eliminar reel temporal', () => request(`/reels/${state.reelId}`, { method: 'DELETE', token: tokenA }));
    state.reelId = null;
    await step('Eliminar evento temporal', () => request(`/eventos/${state.eventId}`, { method: 'DELETE', token: tokenA }));
    state.eventId = null;
    await step('Eliminar cuenta con contrasena correcta', () => request('/usuarios/me', {
      method: 'DELETE', token: tokenA, body: { password },
    }));
    state.tokens[0] = null;
  } finally {
    await cleanup();
  }

  const failures = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ total: results.length, passed: results.length - failures.length, failed: failures.length, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
