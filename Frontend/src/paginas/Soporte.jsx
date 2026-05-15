import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import "./soporte.css";

export default function Soporte() {
  const form = useRef();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const sendEmail = (e) => {
    e.preventDefault();

    // Validación simple
    if (!formData.name || !formData.email || !formData.message) {
      alert("Por favor completá todos los campos");
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
          alert("Tu mensaje fue enviado correctamente");
          form.current.reset();
          setFormData({
            name: "",
            email: "",
            message: "",
          });
        },
        (error) => {
          console.error(error);
          alert("Error al enviar el mensaje: " + error.text);
        }
      )
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="container py-5">
      <h1 className="mb-4 text-center titulo-soporte">
        Centro de Soporte
      </h1>

      {/* FAQ */}
      <div className="accordion mt-3" id="faqAccordion">
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
              En el mapa podés ver los eventos futuros en bares, filtrar por genero musical y artistas.
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
              ¿Como?
            </button>
          </h2>

          <div
            id="faq2"
            className="accordion-collapse collapse custom-collapse"
            data-bs-parent="#faqAccordion"
          >
            <div className="accordion-body">
              No se...
            </div>
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
            <div className="accordion-body">
              No, la app/web es gratuita...
            </div>
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="mt-5">
        <h3>Contactanos</h3>

        <form
          ref={form}
          onSubmit={sendEmail}
          className="formulario-soporte"
        >
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Nombre"
            className="form-control mb-2"
          />

          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email"
            className="form-control mb-2"
          />

          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Mensaje"
            className="form-control mb-2"
            rows="4"
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}