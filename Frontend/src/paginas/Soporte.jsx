import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import "./soporte.css";

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

export default function Soporte() {
  const form = useRef(null);
  const [preguntaActiva, setPreguntaActiva] = useState("mapa");
  const [estado, setEstado] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((actual) => ({
      ...actual,
      [e.target.name]: e.target.value,
    }));
  };

  const usarAtajo = (texto) => {
    setFormData((actual) => ({
      ...actual,
      message: actual.message ? `${actual.message}\n\n${texto}` : texto,
    }));
  };

  const sendEmail = (e) => {
    e.preventDefault();
    setEstado(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setEstado({
        tipo: "error",
        texto: "Completa nombre, email y mensaje para poder ayudarte.",
      });
      return;
    }

    setLoading(true);

    emailjs
      .sendForm(
        "service_ckdohp4",
        "template_jl05slh",
        form.current,
        "EMT5mNLmtGUC83JKA"
      )
      .then(
        () => {
          setEstado({
            tipo: "success",
            texto: "Mensaje enviado. Te vamos a responder apenas podamos.",
          });
          form.current.reset();
          setFormData({
            name: "",
            email: "",
            message: "",
          });
        },
        (error) => {
          console.error(error);
          setEstado({
            tipo: "error",
            texto: "No pudimos enviar el mensaje. Proba de nuevo en unos minutos.",
          });
        }
      )
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <section className="soporte-page">
      <div className="soporte-shell">
        <header className="soporte-hero">
          <div>
            <span>Soporte SONDAR</span>
            <h1>Ayuda clara para seguir sonando.</h1>
            <p>
              Resolvelo rapido con las preguntas frecuentes o escribinos con el detalle del problema.
            </p>
          </div>
          <img src="/logo.png" alt="SONDAR" />
        </header>

        <div className="soporte-grid">
          <section className="soporte-faq" aria-labelledby="soporte-faq-titulo">
            <div className="soporte-section-heading">
              <span>FAQ</span>
              <h2 id="soporte-faq-titulo">Preguntas frecuentes</h2>
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
              <h2 id="soporte-contacto-titulo">Contanos que paso</h2>
            </div>

            <div className="soporte-atajos" aria-label="Motivos frecuentes">
              {atajos.map((atajo) => (
                <button type="button" key={atajo} onClick={() => usarAtajo(atajo)}>
                  {atajo}
                </button>
              ))}
            </div>

            <form ref={form} onSubmit={sendEmail} className="formulario-soporte">
              <label>
                Nombre
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tu@email.com"
                />
              </label>

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

              <button type="submit" className="btn-soporte" disabled={loading}>
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
