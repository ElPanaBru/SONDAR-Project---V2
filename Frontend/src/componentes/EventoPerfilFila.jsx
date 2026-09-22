import { formatearPrecioEvento } from "../lib/formatearPrecioEvento";
import FechaEvento from "./FechaEvento";
import "./eventoPerfilFila.css";

export default function EventoPerfilFila({ evento, onAbrir, seleccionado = false, mostrarPrecioYDistancia = false }) {
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
    <button className={`perfil-evento-fila${seleccionado ? " seleccionado" : ""}`} aria-current={seleccionado ? "true" : undefined} type="button" onClick={() => onAbrir(evento)}>
      <FechaEvento fecha={evento.fecha} />
      <span className="perfil-evento-info">
        <strong>{evento.nombre || "Evento"}</strong>
        <span>{evento.detalle || evento.genero || "Evento de SONDAR"}</span>
        {tieneFecha ? <time dateTime={diaCalendario}>{fechaCompleta}</time> : <span>{fechaCompleta}</span>}
        {mostrarPrecioYDistancia ? (
          <span className="perfil-evento-precio-distancia">
            <span>{precioVisible}</span>
            <span>{distanciaVisible}</span>
          </span>
        ) : null}
      </span>
      <svg className="perfil-evento-flecha" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  );
}
