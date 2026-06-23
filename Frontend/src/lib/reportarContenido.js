import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_ckdohp4";
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_jl05slh";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "zEobDbcTNOMCmcI0O";

export async function avisarDenunciaASoporte({ usuario, tipo, contenidoId, titulo, autor, motivo, detalle }) {
  const email = usuario?.email || "usuario-sin-email@sondar.app";
  const nombre =
    usuario?.user_metadata?.username ||
    usuario?.user_metadata?.name ||
    email.split("@")[0] ||
    "Usuario SONDAR";
  const asunto = `Nueva denuncia de ${tipo} #${contenidoId}`;
  const mensaje = [
    `Tipo: ${tipo}`,
    `ID: ${contenidoId}`,
    `Titulo/perfil: ${titulo || "Sin titulo"}`,
    `Autor denunciado: ${autor || "Sin identificar"}`,
    `Motivo: ${motivo || "Sin especificar"}`,
    `Detalle: ${detalle || "Sin detalle adicional"}`,
    `Reportado por: ${nombre} (${email})`,
    `URL: ${window.location.href}`,
  ].join("\n");

  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    subject: asunto,
    title: asunto,
    name: nombre,
    message: mensaje,
    email,
    user_email: email,
    from_email: email,
    reply_to: email,
    from_name: nombre,
  });
}
