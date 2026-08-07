import { useState } from "react";
import { MOTIVOS_DENUNCIA } from "../lib/denuncias";
import "./denunciaModal.css";

function FormularioDenuncia({ titulo, enviando, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");

  const enviar = (event) => {
    event.preventDefault();
    if (!motivo || enviando) return;
    onConfirm({ motivo, detalle: detalle.trim() });
  };

  return (
    <div className="denuncia-overlay" role="presentation" onMouseDown={() => !enviando && onClose()}>
      <form
        className="denuncia-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="denuncia-titulo"
        onSubmit={enviar}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>DENUNCIAR</span>
            <h2 id="denuncia-titulo">¿Que problema tiene este contenido?</h2>
            {titulo ? <p>{titulo}</p> : null}
          </div>
          <button type="button" onClick={onClose} disabled={enviando} aria-label="Cerrar denuncia">×</button>
        </header>

        <div className="denuncia-motivos">
          {MOTIVOS_DENUNCIA.map((opcion) => (
            <label className={motivo === opcion.id ? "seleccionado" : ""} key={opcion.id}>
              <input
                type="radio"
                name="motivo-denuncia"
                value={opcion.id}
                checked={motivo === opcion.id}
                onChange={(event) => setMotivo(event.target.value)}
              />
              <span>{opcion.label}</span>
            </label>
          ))}
        </div>

        <label className="denuncia-detalle">
          <span>Detalle adicional <small>(opcional)</small></span>
          <textarea
            value={detalle}
            onChange={(event) => setDetalle(event.target.value.slice(0, 500))}
            rows={3}
            maxLength={500}
            placeholder="Contanos brevemente que sucede..."
          />
          <small>{detalle.length}/500</small>
        </label>

        <div className="denuncia-acciones">
          <button type="button" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="enviar" type="submit" disabled={!motivo || enviando}>
            {enviando ? "Enviando..." : "Enviar denuncia"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function DenunciaModal({ abierto, titulo, enviando = false, onClose, onConfirm }) {
  if (!abierto) return null;
  return (
    <FormularioDenuncia
      titulo={titulo}
      enviando={enviando}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
