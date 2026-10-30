import "./mensajesSkeleton.css";

export function ConversacionesSkeleton() {
  return (
    <div className="mensajes-skeleton-lista" role="status" aria-label="Cargando conversaciones" aria-busy="true">
      {Array.from({ length: 6 }, (_, id) => (
        <div className="mensajes-skeleton-fila" key={id} aria-hidden="true">
          <div className="mensajes-skeleton-bloque mensajes-skeleton-avatar" />
          <div className="mensajes-skeleton-lineas">
            <div className="mensajes-skeleton-bloque mensajes-skeleton-nombre" />
            <div className="mensajes-skeleton-bloque mensajes-skeleton-resumen" />
          </div>
          <div className="mensajes-skeleton-bloque mensajes-skeleton-hora" />
        </div>
      ))}
    </div>
  );
}

export function MensajesSkeleton({ completo = false, anteriores = false }) {
  return (
    <div className={`mensajes-skeleton-chat ${completo ? "completo" : ""}`} role="status" aria-label={anteriores ? "Cargando mensajes anteriores" : "Cargando mensajes"} aria-busy="true">
      {completo ? (
        <div className="mensajes-skeleton-fila" aria-hidden="true">
          <div className="mensajes-skeleton-bloque mensajes-skeleton-avatar" />
          <div className="mensajes-skeleton-lineas">
            <div className="mensajes-skeleton-bloque mensajes-skeleton-nombre" />
            <div className="mensajes-skeleton-bloque mensajes-skeleton-hora" />
          </div>
        </div>
      ) : null}
      <div className="mensajes-skeleton-burbujas" aria-hidden="true">
        {Array.from({ length: anteriores ? 2 : 5 }, (_, id) => (
          <div key={id} className={`mensajes-skeleton-bloque mensajes-skeleton-burbuja ${id % 2 ? "propia" : ""}`} />
        ))}
      </div>
      {completo ? <div className="mensajes-skeleton-bloque mensajes-skeleton-composer" aria-hidden="true" /> : null}
    </div>
  );
}