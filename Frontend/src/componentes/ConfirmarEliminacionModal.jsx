import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import "./confirmarEliminacionModal.css";

export default function ConfirmarEliminacionModal({ contenido, onClose, onConfirm }) {
  const tituloId = useId();
  const descripcionId = useId();
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cerrarConEscape = (event) => {
      if (event.key === "Escape" && !confirmando) onClose();
    };

    document.addEventListener("keydown", cerrarConEscape);
    return () => document.removeEventListener("keydown", cerrarConEscape);
  }, [confirmando, onClose]);

  const confirmar = async (event) => {
    event.preventDefault();
    if (!password || confirmando) return;

    setConfirmando(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (confirmacionError) {
      setError(confirmacionError.message || "No se pudo verificar tu contraseña.");
    } finally {
      setConfirmando(false);
    }
  };

  return createPortal(
    <div
      className="confirmar-eliminacion-overlay"
      role="presentation"
      onMouseDown={() => !confirmando && onClose()}
    >
      <form
        className="confirmar-eliminacion-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcionId}
        onSubmit={confirmar}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="confirmar-eliminacion-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 4.5 6v5.4c0 4.7 3.2 8.2 7.5 9.6 4.3-1.4 7.5-4.9 7.5-9.6V6L12 3Z" />
            <path d="M9.5 11.5 11 13l3.5-3.5" />
          </svg>
        </span>

        <div className="confirmar-eliminacion-copy">
          <span>ACCIÓN PROTEGIDA</span>
          <h2 id={tituloId}>Confirmar eliminación</h2>
          <p id={descripcionId}>
            Para eliminar {contenido}, ingresá nuevamente tu contraseña. Este cambio no se puede deshacer.
          </p>
        </div>

        <label className="confirmar-eliminacion-campo">
          <span>Contraseña actual</span>
          <span className="confirmar-eliminacion-password">
            <input
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
              autoFocus
              required
              aria-invalid={Boolean(error)}
            />
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {passwordVisible ? "Ocultar" : "Ver"}
            </button>
          </span>
        </label>

        {error ? <p className="confirmar-eliminacion-error" role="alert">{error}</p> : null}

        <div className="confirmar-eliminacion-acciones">
          <button type="button" onClick={onClose} disabled={confirmando}>Cancelar</button>
          <button className="confirmar-eliminacion-borrar" type="submit" disabled={!password || confirmando}>
            {confirmando ? "Verificando..." : "Eliminar definitivamente"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
