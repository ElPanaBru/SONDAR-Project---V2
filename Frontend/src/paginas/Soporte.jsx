import { useState } from "react";
import emailjs from "@emailjs/browser";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./soporte.css";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_ckdohp4";
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_jl05slh";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "zEobDbcTNOMCmcI0O";

const preguntas = [
  {
    id: "mapa",
    titulo: "Como encuentro eventos cerca mio?",
    texto:
      "En Eventos podes moverte por el mapa, filtrar por genero y abrir cada pin para ver lugar, fecha, organizador y link de compra.",
  },
  {
    id: "reels",
    titulo: "Como publico un reel musical?",
    texto:
      "Desde Descubrir podes crear un reel con portada, audio, genero y descripcion. Si no iniciaste sesion, SONDAR te va a pedir entrar primero.",
  },
  {
    id: "cuenta",
    titulo: "Tengo problemas con mi cuenta",
    texto:
      "Revisa que el correo y la contrasena esten bien escritos. Si el problema sigue, mandanos el email de la cuenta y que accion estabas intentando hacer.",
  },
  {
    id: "gratis",
    titulo: "Tengo que pagar para usar SONDAR?",
    texto:
      "No. Explorar eventos, descubrir musica, comentar y participar en comunidad es gratis.",
  },
];

const atajos = [
  "Problemas para iniciar sesion",
  "No puedo publicar un reel",
  "Quiero reportar un evento",
  "Tengo una sugerencia",
];

export default function Soporte({ usuario }) {
  const { t } = usePreferencias();
  const [preguntaActiva, setPreguntaActiva] = useState("mapa");
  const [estado, setEstado] = useState(null);
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const emailUsuario = usuario?.email?.trim() || "";
  const nombreUsuario =
    usuario?.user_metadata?.username ||
    usuario?.user_metadata?.name ||
    emailUsuario;

  const handleChange = (e) => {
    setFormData((actual) => ({
      ...actual,
      [e.target.name]: e.target.value,
    }));
  };

  const usarAtajo = (texto) => {
    setFormData((actual) => ({
      ...actual,
      subject: texto,
    }));
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    setEstado(null);

    if (!emailUsuario) {
      setEstado({
        tipo: "error",
        texto: "Inicia sesion para enviar un mensaje a soporte.",
      });
      return;
    }

    const subject = formData.subject.trim();
    const message = formData.message.trim();

    if (!subject || !message) {
      setEstado({
        tipo: "error",
        texto: "Completa el asunto y el mensaje para poder ayudarte.",
      });
      return;
    }

    setLoading(true);

    try {
      emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        // Campos nuevos y aliases para seguir siendo compatibles con la plantilla anterior.
        subject,
        title: subject,
        name: nombreUsuario,
        message,
        email: emailUsuario,
        user_email: emailUsuario,
        from_email: emailUsuario,
        reply_to: emailUsuario,
        from_name: nombreUsuario,
      });

      setEstado({
        tipo: "success",
        texto: "Mensaje enviado al equipo de soporte. Te vamos a responder apenas podamos.",
      });
      setFormData({ subject: "", message: "" });
    } catch (error) {
      console.error("EmailJS soporte:", error);
      const detalle = error?.text || error?.message;
      setEstado({
        tipo: "error",
        texto: detalle
          ? `No pudimos enviar el mensaje: ${detalle}`
          : "No pudimos enviar el mensaje. Proba de nuevo en unos minutos.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="soporte-page">
      <div className="soporte-shell">
        <header className="soporte-hero">
          <div>
            <span>Soporte SONDAR</span>
            <h1>{t("Ayuda clara para seguir sonando.")}</h1>
            <p>
              Resolvelo rapido con las preguntas frecuentes o escribinos con el detalle del problema.
            </p>
          </div>
          <img className="soporte-brand" src="/sondar-logo.png" alt="SONDAR" />
        </header>

        <div className="soporte-grid">
          <section className="soporte-faq" aria-labelledby="soporte-faq-titulo">
            <div className="soporte-section-heading">
              <span>FAQ</span>
              <h2 id="soporte-faq-titulo">{t("Preguntas frecuentes")}</h2>
            </div>

            <div className="soporte-faq-lista">
              {preguntas.map((pregunta) => {
                const abierta = preguntaActiva === pregunta.id;

                return (
                  <article className={`soporte-faq-item ${abierta ? "abierta" : ""}`} key={pregunta.id}>
                    <button
                      type="button"
                      aria-expanded={abierta}
                      onClick={() => setPreguntaActiva(abierta ? "" : pregunta.id)}
                    >
                      <span>{pregunta.titulo}</span>
                      <strong>{abierta ? "-" : "+"}</strong>
                    </button>
                    {abierta ? <p>{pregunta.texto}</p> : null}
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="soporte-contacto" aria-labelledby="soporte-contacto-titulo">
            <div className="soporte-section-heading">
              <span>Contacto</span>
              <h2 id="soporte-contacto-titulo">{t("Contanos qué pasó")}</h2>
            </div>

            <div className="soporte-atajos" aria-label="Motivos frecuentes">
              {atajos.map((atajo) => (
                <button type="button" key={atajo} onClick={() => usarAtajo(atajo)}>
                  {atajo}
                </button>
              ))}
            </div>

            <form onSubmit={sendEmail} className="formulario-soporte">
              <label>
                Asunto
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Resumen breve de tu consulta"
                  autoComplete="off"
                />
              </label>

              <p className="soporte-email-usuario">
                {emailUsuario
                  ? <>Tu consulta se enviara al equipo de soporte. Cuenta asociada: <strong>{emailUsuario}</strong>.</>
                  : "Inicia sesion para que podamos identificar tu correo."}
              </p>

              <label>
                Mensaje
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Escribi que paso, en que pantalla estabas y que esperabas que ocurra."
                  rows="5"
                />
              </label>

              <button type="submit" className="btn-soporte" disabled={loading || !emailUsuario}>
                {loading ? "Enviando..." : "Enviar mensaje"}
              </button>
            </form>

            {estado ? (
              <p className={`alert-soporte ${estado.tipo}`} role="status">
                {estado.texto}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
