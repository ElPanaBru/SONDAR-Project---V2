import { apiJson } from "./api";
export async function avisarDenunciaASoporte({
  tipo,
  contenidoId,
  titulo,
  autor,
  motivo,
  detalle,
  nombreUsuario,
  url,
}) {
  const urlContenido = url || window.location.href;

  return apiJson("/api/soporte/mensaje", {
    method: "POST",
    body: {
      tipo: "denuncia",
      contenidoTipo: tipo,
      contenidoId,
      titulo,
      autor,
      motivo,
      detalle,
      nombreUsuario,
      url: urlContenido,
    },
  });
}
