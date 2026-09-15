import "./perfilSkeleton.css";

export default function PerfilSkeleton({ ajeno = false }) {
  return (
    <section className={`perfil-page perfil-skeleton-page ${ajeno ? "otroperfil-page" : ""}`} aria-busy="true" aria-label="Cargando perfil">
      <span className="perfil-skeleton-status" role="status">Cargando perfil...</span>
      <div aria-hidden="true">
        <div className="perfil-card">
          <div className="perfil-avatar-zone">
            <div className="perfil-avatar perfil-skeleton perfil-skeleton-avatar" />
          </div>
          <div className="perfil-info">
            <div className="perfil-title-row">
              <div className="perfil-skeleton perfil-skeleton-title" />
              <div className="perfil-skeleton perfil-skeleton-button" />
              <div className="perfil-skeleton perfil-skeleton-button" />
            </div>
            <div className="perfil-skeleton-stats">
              {[0, 1, 2].map((id) => <div key={id} className="perfil-skeleton perfil-skeleton-stat" />)}
            </div>
            <div className="perfil-skeleton-description">
              <div className="perfil-skeleton perfil-skeleton-name" />
              <div className="perfil-skeleton perfil-skeleton-handle" />
              <div className="perfil-skeleton perfil-skeleton-bio" />
            </div>
          </div>
        </div>
        <div className="perfil-skeleton-tabs">
          {Array.from({ length: ajeno ? 3 : 5 }, (_, id) => <div key={id} className="perfil-skeleton" />)}
        </div>
        <div className="perfil-publicaciones-grid">
          {Array.from({ length: 6 }, (_, id) => <div key={id} className="perfil-skeleton perfil-skeleton-card" />)}
        </div>
      </div>
    </section>
  );
}