import { useState } from "react";
import "./soporte.css";

export default function Soporte() {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    mensaje: ""
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Mensaje enviado:", form);
    alert("Tu mensaje fue enviado correctamente");
    setForm({ nombre: "", email: "", mensaje: "" });
  };

  return (
    <div className="container py-5">
      <h1 className="mb-4 text-center titulo-soporte">Centro de Soporte</h1>

      {/* FAQ */}
      <div className="accordion mt-3" id="faqAccordion">

  {/* ITEM 1 */}
  <div className="accordion-item">
    <h2 className="accordion-header">
      <button className="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">¿Cómo se usa el mapa? </button>
    </h2>
    <div id="faq1" className="accordion-collapse collapse show custom-collapse" data-bs-parent="#faqAccordion">
      <div className="accordion-body">
        En el mapa podés ver los futuros eventos de los musicos a los que seguis
      </div>
    </div>
  </div>

  {/* ITEM 2 */}
  <div className="accordion-item">
    <h2 className="accordion-header">
      <button
        className="accordion-button collapsed"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#faq2"
      >
        ¿Cómo agrego un bar?
      </button>
    </h2>
    <div
      id="faq2"
      className="accordion-collapse collapse custom-collapse"
      data-bs-parent="#faqAccordion"
    >
      <div className="accordion-body">
        Desde el mapa podés sugerir nuevos lugares...
      </div>
    </div>
  </div>

  {/* ITEM 3 */}
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
    <div id="faq3" className="accordion-collapse collapse custom-collapse" data-bs-parent="#faqAccordion"
    >
      <div className="accordion-body">
        No, la app/web es gratuita...
      </div>
    </div>
  </div>
</div>
<div className="mt-5">
  <h3>Contactanos</h3>

  <form onSubmit={handleSubmit} className="mt-3">
    <input type="text" name="nombre" value={form.nombre} onChange={handleChange} placeholder="Nombre" className="form-control mb-2"/>
    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email" className="form-control mb-2"/>
    <textarea name="mensaje" value={form.mensaje} onChange={handleChange} placeholder="Mensaje" className="form-control mb-2"/>
    <button className="btn btn-primary">Enviar</button>
  </form>
</div>
    </div>
  );
}