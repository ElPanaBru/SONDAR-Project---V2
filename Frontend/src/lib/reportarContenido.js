import { apiRequest } from "./api";

export async function avisarDenunciaASoporte({
  tipo,
  contenidoId,
  titulo,
  autor,
  motivo,
  detalle,
  nombreUsuario,
}) {
  const response = await apiRequest("/api/soporte/mensaje", {
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
      url: window.location.href,
    },
  });
  const resultado = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(resultado.error || "No se pudo notificar a soporte.");
  return resultado;
}


