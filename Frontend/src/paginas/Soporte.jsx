import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import "./soporte.css";

export default function Soporte() {
  const form = useRef(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    type: "idle", // idle | success | error
    message: "",
  });

  const sendEmail = (e) => {
    e.preventDefault();

    const formEl = form.current;
    if (!formEl) return;

    // EmailJS lee del DOM, así que validamos desde los inputs del formulario.
    const fd = new FormData(formEl);
    const name = String(fd.get("name") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const message = String(fd.get("message") || "").trim();

    if (!name || !email || !message) {
      setStatus({ type: "error", message: "Por favor completá todos los campos." });
      return;
    }

    setLoading(true);
    setStatus({ type: "idle", message: "" });

    // Inicializa una sola vez por carga.
    emailjs.init("EMT5mNLmtGUC83JKA");

    emailjs
      .sendForm(
        "service_ckdohp4",
        "template_jl05slh",
        formEl,
        "EMT5mNLmtGUC83JKA"
      )
      .then(
        () => {
          setStatus({ type: "success", message: "Tu mensaje fue enviado correctamente." });
          formEl.reset();
        },
        (error) => {
          console.error("EmailJS sendForm error:", error);
          setStatus({
            type: "error",
            message:
              "Error al enviar el mensaje. " +
              (error?.text || error?.message || "Detalle desconocido"),
          });
        }
      )
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="soporte-page">
      <h1 className="titulo-soporte">Centro de Soporte</h1>

      <div className="soporte-grid">
        {/* FAQ */}
        <div>
          <div className="accordion" id="faqAccordion">
            <div className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#faq1"
                >
                  ¿Cómo se usa el mapa?
                </button>
              </h2>

              <div
                id="faq1"
                className="accordion-collapse collapse show custom-collapse"
                data-bs-parent="#faqAccordion"
              >
                <div className="accordion-body">
                  En el mapa podés ver los eventos futuros en bares, filtrar por
                  género musical y artistas.
                </div>
              </div>
            </div>

            <div className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#faq2"
                >
                  ¿Cómo?
                </button>
              </h2>

              <div
                id="faq2"
                className="accordion-collapse collapse custom-collapse"
                data-bs-parent="#faqAccordion"
              >
                <div className="accordion-body">No se...</div>
              </div>
            </div>

            <div className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#faq3"
                >
                  ¿Tengo que pagar?
                </button>
              </h2>

              <div
                id="faq3"
                className="accordion-collapse collapse custom-collapse"
                data-bs-parent="#faqAccordion"
              >
                <div className="accordion-body">No, la app/web es gratuita...</div>
              </div>
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="soporte-form-wrap">
          <h3 className="soporte-form-title">Contactanos</h3>

          <form ref={form} onSubmit={sendEmail} className="formulario-soporte">
            <input
              type="text"
              name="name"
              placeholder="Nombre"
              className="form-control"
              autoComplete="name"
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              className="form-control"
              autoComplete="email"
            />

            <textarea
              name="message"
              placeholder="Mensaje"
              className="form-control"
              rows="5"
            />

            {status.type !== "idle" && (
              <div
                className={
                  status.type === "success" ? "alert-soporte success" : "alert-soporte error"
                }
                role="alert"
              >
                {status.message}
              </div>
            )}

            <button type="submit" className="btn-soporte" disabled={loading}>
              {loading ? "Enviando..." : "Enviar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


