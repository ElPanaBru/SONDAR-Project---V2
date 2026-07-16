type AnyRecord = Record<string, any>;

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function normalizeHandle(value: unknown, fallback = 'usuario') {
  const text = String(value || fallback).trim().replace(/^@+/, '');
  return `@${text || fallback}`;
}

export function normalizeComment(item: AnyRecord = {}) {
  return {
    ...item,
    id: toNumber(item.id),
    usuario: item.usuario || normalizeHandle(item.username || item.autor || item.email?.split?.('@')?.[0]),
    autor: item.autor || item.username || item.usuario || 'Usuario SONDAR',
    avatar: item.avatar || item.profile_img_url || '',
    texto: item.texto || '',
    likes: toNumber(item.likes ?? item.votos),
    votos: toNumber(item.votos ?? item.likes),
    liked: toBoolean(item.liked),
    respuestas: (item.respuestas || []).map(normalizeComment),
  };
}

export function normalizeReel(item: AnyRecord = {}) {
  const backendId = item.backendId ?? item.backend_id ?? item.id;
  return {
    ...item,
    id: item.id,
    backendId,
    artista: item.artista || item.creador || item.creador_nombre || item.username || 'Artista SONDAR',
    usuario: item.usuario || normalizeHandle(item.creador_nombre || item.username || item.artista || 'artista'),
    tema: item.tema || item.titulo || 'Sin titulo',
    album: item.album || item.nombre || 'Nuevo reel',
    genero: item.genero || 'otros',
    descripcion: item.descripcion || '',
    portada: item.portada || item.portada_url || item.imagen || item.img || '',
    audio: item.audio || item.audio_url || '',
    avatar: item.avatar || item.creador_avatar || item.profile_img_url || '',
    likes: toNumber(item.likes),
    comentarios: toNumber(item.comentarios ?? item.comentariosTotal ?? item.comentarios_total),
    compartidos: toNumber(item.compartidos),
    guardados: toNumber(item.guardados),
    visitas: toNumber(item.visitas),
    liked: toBoolean(item.liked),
    guardado: toBoolean(item.guardado),
    siguiendo: toBoolean(item.siguiendo ?? item.following),
    creadorId: item.creadorId || item.creador_id || item.userId || item.user_id,
    duracion: item.duracion || '0:30',
  };
}

export function normalizeEvent(item: AnyRecord = {}) {
  const place = item.lugar || item.ubicacion || '';
  const image = item.img || item.img_url || item.imagen || item.portada || '';
  return {
    ...item,
    id: item.id,
    titulo: item.titulo || item.nombre || 'Evento SONDAR',
    descripcion: item.descripcion || '',
    genero: item.genero || 'otros',
    lugar: place,
    ubicacion: place,
    fecha: item.fecha,
    img: image,
    img_url: item.img_url || image,
    precio: item.precio ?? null,
    link: item.link || '',
    latitud: item.latitud ?? item.latitude,
    longitud: item.longitud ?? item.longitude,
    creador: item.creador || item.username || null,
    creador_id: item.creador_id || item.creadorId,
    avatar: item.avatar || item.profile_img_url || '',
    guardado: toBoolean(item.guardado),
    organizadores: item.organizadores || [],
  };
}

export function normalizeCommunity(item: AnyRecord = {}) {
  return {
    ...item,
    id: item.id || item.genero || item.nombre,
    nombre: item.nombre || normalizeHandle(item.genero || item.titulo || 'comunidad'),
    titulo: item.titulo || item.nombre || 'Comunidad',
    genero: item.genero || item.categoria || 'otros',
    descripcion: item.descripcion || '',
    miembros: toNumber(item.miembros),
    publicaciones: toNumber(item.publicaciones),
    portada: item.portada || item.portada_url || '',
  };
}

export function normalizeCommunityPost(item: AnyRecord = {}) {
  const comments = (item.comentarios || []).map(normalizeComment);
  return {
    ...item,
    id: toNumber(item.id),
    comunidadId: item.comunidadId || item.comunidad_id,
    userId: item.userId || item.user_id,
    op: item.op || item.autor || item.username || 'Usuario SONDAR',
    usuario: item.usuario || normalizeHandle(item.username || item.op || item.email?.split?.('@')?.[0]),
    tipo: item.tipo || 'reciente',
    titulo: item.titulo || 'Publicacion',
    texto: item.texto || '',
    etiqueta: item.etiqueta || item.genero || '',
    likes: toNumber(item.likes ?? item.votos),
    votos: toNumber(item.votos ?? item.likes),
    liked: toBoolean(item.liked),
    guardado: toBoolean(item.guardado),
    comentarios: comments,
    comentariosTotal: toNumber(item.comentariosTotal ?? item.comentarios_total, comments.length),
    tiempo: item.tiempo || '',
  };
}
