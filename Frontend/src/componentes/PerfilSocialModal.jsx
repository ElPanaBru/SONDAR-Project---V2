import { useId } from "react";
import "./perfilSocialModal.css";

export default function PerfilSocialModal({
  abierto,
  titulo,
  perfiles = [],
  mensajeVacio,
  onClose,
  onSelect,
}) {
  const tituloId = useId();

  if (!abierto) return null;

  return (
    <div className="perfil-social-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="perfil-social-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="perfil-social-header">
          <h2 id={tituloId}>{titulo}</h2>
          <button
            className="perfil-social-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar lista"
          >
            x
          </button>
        </div>

        <div className="perfil-social-lista">
          {perfiles.length > 0 ? (
            perfiles.map((perfilSocial) => (
              <button
                className="perfil-social-item"
                type="button"
                key={perfilSocial.id}
                onClick={() => onSelect(perfilSocial)}
              >
                <span>
                  {perfilSocial.avatar ? (
                    <img src={perfilSocial.avatar} alt="" />
                  ) : (
                    perfilSocial.nombre?.charAt(0).toUpperCase() || "S"
                  )}
                </span>
                <strong>{perfilSocial.nombre}</strong>
                <small>{perfilSocial.usuario}</small>
              </button>
            ))
          ) : (
            <p className="perfil-social-vacio">{mensajeVacio}</p>
          )}
        </div>
      </section>
    </div>
  );
}
