import emailjs from "emailjs-com";

const SERVICE_ID = "service_ckdohp4";
const TEMPLATE_ID = "template_jl05slh";
const PUBLIC_KEY = "AG58ztaqMTuDqZNbX";

const DESTINO_EMAIL = "sonaradevteam@gmail.com";

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
  const descripcion = `${nombreUsuario || "Usuario"} denuncio un ${tipo || "contenido"}`;
  const asunto = `${nombreUsuario || "Usuario"} denuncio ${tipo || "contenido"}`;
  const message = [
    asunto + ":",
    `Motivo: ${motivo || ""}`,
    detalle ? `Detalle adicional: ${detalle}` : null,
    `ContenidoId: ${contenidoId || ""}`,
    titulo ? `Titulo: ${titulo}` : null,
    autor ? `Autor: ${autor}` : null,
    `URL: ${urlContenido}`,
  ]
    .filter(Boolean)
    .join("\n");

  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      tipo: "denuncia",
      contenidoTipo: tipo,
      contenidoId,
      titulo,
      autor,
      motivo,
      detalle,
      descripcion,
      asunto,
      message,
      url: urlContenido,
      to_email: DESTINO_EMAIL,
    },
    PUBLIC_KEY
  );
}


