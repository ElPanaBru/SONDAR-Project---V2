import { useEffect } from "react";
import "./compartirContenidoModal.css";

function IconoCompartir({ tipo }) {
  if (tipo === "copy") {
    return (
      <span className="compartir-contenido-icono compartir-contenido-icono-copy" aria-hidden="true">
        <svg viewBox="0 -960 960 960" focusable="false">
          <path d="M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80Zm-120-160v-80h320v80H320Zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H520Z" />
        </svg>
      </span>
    );
  }

  if (tipo === "whatsapp") {
    return (
      <span className="compartir-contenido-icono compartir-contenido-icono-whatsapp" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M32 7C18.7 7 8 17.2 8 29.9c0 4.5 1.4 8.8 3.8 12.4L9.3 55 22.5 51c3 1.2 6.2 1.8 9.5 1.8 13.3 0 24-10.2 24-22.9S45.3 7 32 7Z" />
          <path d="M24.2 19.1c-.6 0-1.4.2-2 1.1-.7.9-2.4 2.4-2.4 5.7s2.4 6.5 2.8 6.9c.3.5 4.7 7.5 11.6 10.1 5.7 2.2 6.9 1.8 8.1 1.7 1.2-.1 4-1.6 4.6-3.2.6-1.6.6-2.9.4-3.2-.2-.3-.6-.5-1.3-.9s-4-2-4.6-2.2c-.6-.2-1.1-.3-1.5.3-.5.7-1.8 2.2-2.2 2.7-.4.5-.8.5-1.5.2s-3-.9-5.6-3.2c-2.1-1.8-3.5-4.1-3.9-4.8-.4-.7 0-1 .3-1.4.3-.3.7-.8 1-1.2.3-.4.5-.7.7-1.2.2-.5.1-.9-.1-1.2-.2-.3-1.5-3.8-2.1-5.2-.5-1.3-1.1-1.1-1.5-1.1h-.8Z" />
        </svg>
      </span>
    );
  }

  if (tipo === "facebook") {
    return (
      <span className="compartir-contenido-icono compartir-contenido-icono-facebook" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false">
          <path d="M57 32C57 18.2 45.8 7 32 7S7 18.2 7 32c0 12.5 9.2 22.9 21.2 24.7V39.2h-6.3V32h6.3v-5.5c0-6.2 3.7-9.7 9.4-9.7 2.7 0 5.6.5 5.6.5v6.2H40c-3.1 0-4.1 1.9-4.1 3.9V32h7l-1.1 7.2h-5.9v17.5C47.8 54.9 57 44.5 57 32Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="compartir-contenido-icono compartir-contenido-icono-instagram" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        <rect x="14" y="14" width="36" height="36" rx="11" />
        <circle cx="32" cy="32" r="9" />
        <circle cx="43" cy="21" r="3" />
      </svg>
    </span>
  );
}

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto);
    return;
  }

  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.appendChild(campo);
  campo.select();
  const copiado = document.execCommand("copy");
  campo.remove();
  if (!copiado) throw new Error("No se pudo copiar el enlace");
}

export default function CompartirContenidoModal({
  titulo,
  nombre,
  detalle,
  imagen,
  imagenContenida = false,
  enlace,
  textoCompartir,
  mensajeCopiado = "Enlace copiado",
  onClose,
  onAviso,
}) {
  useEffect(() => {
    const cerrarConEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [onClose]);

  const copiar = async (mensaje = mensajeCopiado) => {
    try {
      await copiarTexto(enlace);
      onAviso?.(mensaje);
    } catch {
      onAviso?.("No se pudo copiar el enlace en este navegador.");
    }
  };

  const compartirEnRed = async (red) => {
    const destinos = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(textoCompartir)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(enlace)}`,
      instagram: "https://www.instagram.com/",
    };

    window.open(destinos[red], "_blank", "noopener,noreferrer");
    if (red === "instagram") await copiar("Enlace copiado para Instagram");
  };

  return (
    <div className="compartir-contenido-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="compartir-contenido-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compartir-contenido-titulo"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="compartir-contenido-header">
          <h2 id="compartir-contenido-titulo">{titulo}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar compartir" title="Cerrar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
            </svg>
          </button>
        </header>

        <div className="compartir-contenido-preview">
          <span className={imagenContenida ? "imagen-contenida" : ""}>
            {imagen ? <img src={imagen} alt="" /> : nombre?.charAt(0).toUpperCase() || "S"}
          </span>
          <strong>{nombre}</strong>
          <small>{detalle}</small>
        </div>

        <div className="compartir-contenido-acciones">
          <button type="button" onClick={() => copiar()}>
            <IconoCompartir tipo="copy" />
            Copiar
          </button>
          <button type="button" onClick={() => compartirEnRed("whatsapp")}>
            <IconoCompartir tipo="whatsapp" />
            WhatsApp
          </button>
          <button type="button" onClick={() => compartirEnRed("facebook")}>
            <IconoCompartir tipo="facebook" />
            Facebook
          </button>
          <button type="button" onClick={() => compartirEnRed("instagram")}>
            <IconoCompartir tipo="instagram" />
            Instagram
          </button>
        </div>

        <div className="compartir-contenido-link">
          <span title={enlace}>{enlace}</span>
          <button type="button" onClick={() => copiar()}>Copiar enlace</button>
        </div>
      </section>
    </div>
  );
}
