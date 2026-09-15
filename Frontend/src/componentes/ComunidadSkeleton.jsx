import "./comunidadSkeleton.css";

function Bloque({ clase = "" }) {
  return <div className={`comunidad-skeleton-bloque ${clase}`} />;
}

export function PublicacionesSkeleton() {
  return (
    <div className="comunidad-skeleton-posts" role="status" aria-label="Cargando publicaciones y comentarios" aria-busy="true">
      {[0, 1, 2].map((id) => (
        <div className="comunidad-skeleton-post" key={id} aria-hidden="true">
          <div className="comunidad-skeleton-fila">
            <Bloque clase="comunidad-skeleton-avatar" />
            <Bloque clase="comunidad-skeleton-nombre" />
            <Bloque clase="comunidad-skeleton-tiempo" />
          </div>
          <Bloque clase="comunidad-skeleton-etiqueta" />
          <Bloque clase="comunidad-skeleton-titulo" />
          <Bloque clase="comunidad-skeleton-texto" />
          <Bloque clase="comunidad-skeleton-texto corto" />
          <div className="comunidad-skeleton-fila">
            {[0, 1, 2].map((accion) => <Bloque key={accion} clase="comunidad-skeleton-boton" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ComunidadSkeleton() {
  return (
    <main className="comunidad-container" aria-busy="true" aria-label="Cargando Comunidad">
      <section className="comunidad-layout reddit-layout">
        <aside className="comunidad-sidebar subreddit-list" aria-hidden="true">
          <div className="comunidad-panel">
            <Bloque clase="comunidad-skeleton-titulo" />
            {Array.from({ length: 8 }, (_, id) => (
              <div className="comunidad-skeleton-foro comunidad-skeleton-fila" key={id}>
                <Bloque clase="comunidad-skeleton-avatar" />
                <Bloque clase="comunidad-skeleton-nombre" />
              </div>
            ))}
          </div>
        </aside>
        <div className="comunidad-contenido">
          <div className="comunidad-portada" aria-hidden="true">
            <Bloque clase="comunidad-skeleton-cover" />
            <div className="comunidad-skeleton-identidad comunidad-skeleton-fila">
              <Bloque clase="comunidad-skeleton-avatar" />
              <Bloque clase="comunidad-skeleton-nombre" />
              <Bloque clase="comunidad-skeleton-boton" />
            </div>
          </div>
          <div className="comunidad-main"><PublicacionesSkeleton /></div>
          <aside className="comunidad-sidebar detalle-comunidad" aria-hidden="true">
            <div className="comunidad-panel comunidad-skeleton-resumen">
              <Bloque clase="comunidad-skeleton-titulo" />
              <Bloque clase="comunidad-skeleton-texto" />
              <Bloque clase="comunidad-skeleton-texto corto" />
              <div className="comunidad-skeleton-fila">
                {[0, 1, 2].map((id) => <Bloque key={id} clase="comunidad-skeleton-boton" />)}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}