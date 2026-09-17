import "./eventoPerfilFila.css";

export default function EventoPerfilFila({ evento, onAbrir }) {
  const diaCalendario = String(evento.fecha || "").slice(0, 10);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(diaCalendario) ? new Date(`${diaCalendario}T12:00:00`) : null;
  const tieneFecha = fecha && !Number.isNaN(fecha.getTime());
  const fechaCompleta = tieneFecha
    ? new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(fecha)
    : "Fecha a confirmar";

  return (
    <button className="perfil-evento-fila" type="button" onClick={() => onAbrir(evento)}>
      <span className="perfil-evento-calendario" aria-hidden="true">
        {tieneFecha ? <><strong>{fecha.getDate()}</strong><small>{new Intl.DateTimeFormat("es-AR", { month: "short" }).format(fecha)}</small></> : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18" /></svg>
        )}
      </span>
      <span className="perfil-evento-info">
        <strong>{evento.nombre || "Evento"}</strong>
        <span>{evento.detalle || evento.genero || "Evento de SONDAR"}</span>
        {tieneFecha ? <time dateTime={diaCalendario}>{fechaCompleta}</time> : <span>{fechaCompleta}</span>}
      </span>
      <svg className="perfil-evento-flecha" aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  );
}
