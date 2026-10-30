import "./buscarSkeleton.css";

export default function BuscarSkeleton({ tab = "todo" }) {
  return (
    <div className="buscar-skeleton" role="status" aria-label="Buscando resultados" aria-busy="true">
      {tab === "todo" ? (
        <div className="buscar-skeleton-destacado" aria-hidden="true">
          <div className="buscar-skeleton-bloque buscar-skeleton-portada" />
          <div className="buscar-skeleton-lineas">
            <div className="buscar-skeleton-bloque buscar-skeleton-detalle" />
            <div className="buscar-skeleton-bloque buscar-skeleton-titulo" />
            <div className="buscar-skeleton-bloque buscar-skeleton-detalle" />
          </div>
        </div>
      ) : null}
      {Array.from({ length: 6 }, (_, id) => (
        <div className="buscar-skeleton-fila" key={id} aria-hidden="true">
          <div className={`buscar-skeleton-bloque buscar-skeleton-thumb ${tab === "usuarios" || (tab === "todo" && id < 3) ? "usuario" : ""}`} />
          <div className="buscar-skeleton-lineas">
            <div className="buscar-skeleton-bloque buscar-skeleton-nombre" />
            <div className="buscar-skeleton-bloque buscar-skeleton-detalle" />
          </div>
          <div className="buscar-skeleton-bloque buscar-skeleton-meta" />
          <div className="buscar-skeleton-bloque buscar-skeleton-accion" />
        </div>
      ))}
    </div>
  );
}