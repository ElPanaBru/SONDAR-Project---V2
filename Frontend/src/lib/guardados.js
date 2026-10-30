export const CATEGORIAS_GUARDADOS = [
  { id: "reel", nombre: "Reels", icono: "play_circle", vacio: "Todavía no guardaste reels." },
  { id: "evento", nombre: "Eventos", icono: "event", vacio: "Todavía no guardaste eventos." },
  { id: "publicacion-comunidad", nombre: "Publicaciones", icono: "forum", vacio: "Todavía no guardaste publicaciones de Comunidad." },
  { id: "comentario-comunidad", nombre: "Comentarios", icono: "chat_bubble", vacio: "Todavía no guardaste comentarios de Comunidad." },
];
export function filtrarGuardados(items, categoria) {
  return items.filter((item) => (item.tipo || item.guardadoTipo) === categoria);
}
