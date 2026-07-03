import { apiJson } from "./api";

export async function avisarDenunciaASoporte({ tipo, contenidoId, titulo, autor, motivo, detalle }) {
  await apiJson("/api/soporte/mensaje", {
    method: "POST",
    body: {
      tipo: "denuncia",
      contenidoTipo: tipo,
      contenidoId,
      titulo,
      autor,
      motivo,
      detalle,
      url: window.location.href,
    },
  });
}
