import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./perfilToast.css";

export default function PerfilToast({ mensaje, onClose, duracion = 5000 }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mensaje) return undefined;
    const timer = window.setTimeout(() => onCloseRef.current?.(), duracion);
    return () => window.clearTimeout(timer);
  }, [duracion, mensaje]);

  if (!mensaje) return null;

  return createPortal(
    <div
      className="perfil-toast-flotante"
      role="status"
      aria-live="polite"
      style={{ "--perfil-toast-duracion": `${duracion}ms` }}
    >
      <span className="perfil-toast-mensaje">{mensaje}</span>
    </div>,
    document.body
  );
}
