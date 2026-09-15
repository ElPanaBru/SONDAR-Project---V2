import "./descubrirSkeleton.css";
export default function DescubrirSkeleton() {
  return (
    <div className="descubrir-skeleton" role="status" aria-label="Cargando previews">
      <div className="descubrir-skeleton-layout" aria-hidden="true">
        <div className="descubrir-skeleton-portada descubrir-skeleton-bloque" />
        <div className="descubrir-skeleton-acciones">
          {Array.from({ length: 5 }, (_, id) => (
            <div className="descubrir-skeleton-accion" key={id}>
              <div className="descubrir-skeleton-icono descubrir-skeleton-bloque" />
              {id < 4 ? <div className="descubrir-skeleton-conteo descubrir-skeleton-bloque" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}