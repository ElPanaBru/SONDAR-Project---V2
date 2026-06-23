export const MOTIVOS_DENUNCIA = [
  { id: "contenido_explicito", label: "Contenido sexual o explicito" },
  { id: "violencia", label: "Violencia o contenido peligroso" },
  { id: "odio_acoso", label: "Odio, discriminacion o acoso" },
  { id: "spam_estafa", label: "Spam, engaño o estafa" },
  { id: "derechos_autor", label: "Infraccion de derechos de autor" },
  { id: "informacion_falsa", label: "Informacion falsa" },
  { id: "otro", label: "Otro motivo" },
];

export function etiquetaMotivoDenuncia(id) {
  return MOTIVOS_DENUNCIA.find((motivo) => motivo.id === id)?.label || id;
}
