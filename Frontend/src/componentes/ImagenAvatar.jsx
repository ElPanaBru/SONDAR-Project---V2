import { useCallback, useState } from "react";
import "./imagenAvatar.css";

function ImagenAvatarContenido({ src, alt = "", inicial = "S", className = "", loading }) {
  const [estado, setEstado] = useState(src ? "cargando" : "error");
  const comprobarCache = useCallback((imagen) => {
    if (imagen?.complete && imagen.naturalWidth > 0) setEstado("lista");
  }, []);

  return (
    <span className={`avatar-imagen ${estado === "cargando" ? "avatar-imagen-cargando" : ""} ${className}`} aria-busy={estado === "cargando"}>
      {estado === "error" ? (
        <b className="avatar-imagen-inicial" role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
          {String(inicial || alt || "S").replace(/^@/, "").charAt(0).toUpperCase()}
        </b>
      ) : (
        <img
          ref={comprobarCache}
          src={src}
          alt={alt}
          loading={loading}
          style={{ opacity: estado === "lista" ? 1 : 0 }}
          onLoad={() => setEstado("lista")}
          onError={() => setEstado("error")}
        />
      )}
    </span>
  );
}

export default function ImagenAvatar(props) {
  // Reset loading when the user or photo changes, including cached images.
  return <ImagenAvatarContenido key={props.src || "sin-foto"} {...props} />;
}
