import { useEffect, useState } from "react";
import "./denunciaModal.css";

export const MOTIVOS_DENUNCIA = [
  { id: "contenido_explicito", label: "Contenido sexual o explicito" },
  { id: "violencia", label: "Violencia o contenido peligroso" },
  { id: "odio_acoso", label: "Odio, discriminacion o acoso" },
  { id: "spam_estafa", label: "Spam, engaño o estafa" },
  { id: "derechos_autor", label: "Infraccion de derechos de autor" },
  { id: "informacion_falsa", label: "Informacion falsa" },
  { id: "otro", label: "Otro motivo" },
];

export function etiquetaMotivoDenuncia(id) {
  return MOTIVOS_DENUNCIA.find((motivo) => motivo.id === id)?.label || id;
}

export default function DenunciaModal({ abierto, titulo, enviando = false, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setMotivo("");
    setDetalle("");
  }, [abierto]);

  if (!abierto) return null;

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
