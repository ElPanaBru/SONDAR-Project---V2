import { formatearPrecioEvento } from "../lib/formatearPrecioEvento";
import { nombreGeneroMusical } from "../lib/generos";
import FechaEvento from "./FechaEvento";
import "./eventoPerfilFila.css";

export default function EventoPerfilFila({
  evento,
  onAbrir,
  seleccionado = false,
  mostrarPrecioYDistancia = false,
  className = "",
  seleccionable = false,
  etiqueta,
}) {
  const generos = Array.isArray(evento.generos) && evento.generos.length > 0 ? evento.generos : [evento.genero];
  const detalle = evento.detalle || [
    [...new Set(generos.filter(Boolean))].map(nombreGeneroMusical).join(" / "),
    evento.lugar || evento.ubicacion,
  ].filter(Boolean).join(" · ") || "Evento de SONDAR";
  const diaCalendario = String(evento.fecha || "").slice(0, 10);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(diaCalendario) ? new Date(`${diaCalendario}T12:00:00`) : null;
  const tieneFecha = fecha && !Number.isNaN(fecha.getTime());
  const fechaCompleta = tieneFecha
    ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(fecha)
    : "Fecha a confirmar";

  const distancia = Number(evento.distancia_km);
  const tieneDistancia = evento.distancia_km != null && evento.distancia_km !== "" && Number.isFinite(distancia) && distancia >= 0;
  const precioVisible = formatearPrecioEvento(evento.precio);
  const distanciaVisible = tieneDistancia
    ? (distancia > 0 && distancia < 0.1 ? "< 0,1" : distancia.toLocaleString("es-AR", { maximumFractionDigits: 1 })) + " km de vos"
    : "Distancia no disponible";

  return (
    <button
      className={`perfil-evento-fila${seleccionado ? " seleccionado" : ""}${className ? ` ${className}` : ""}`}
      aria-current={!seleccionable && seleccionado ? "true" : undefined}
      aria-pressed={seleccionable ? seleccionado : undefined}
      type="button"
      onClick={() => onAbrir(evento)}
    >
      <FechaEvento fecha={evento.fecha} />
      <span className="perfil-evento-info">
        {etiqueta ? <span className="perfil-evento-etiqueta">{etiqueta}</span> : null}
        <strong>{evento.nombre || (evento.creador ? `Evento de ${evento.creador}` : evento.lugar || "Evento")}</strong>
        <span>{detalle}</span>
        {tieneFecha ? <time dateTime={diaCalendario}>{fechaCompleta}</time> : <span>{fechaCompleta}</span>}
        {mostrarPrecioYDistancia ? (
          <span className="perfil-evento-precio-distancia">
            <span>{precioVisible}</span>
            <span>{distanciaVisible}</span>
          </span>
        ) : null}
      </span>
      <svg className="perfil-evento-flecha" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={seleccionable ? (seleccionado ? "m5 12 4 4L19 6" : "M12 5v14M5 12h14") : "m9 6 6 6-6 6"} />
      </svg>
    </button>
  );
}
