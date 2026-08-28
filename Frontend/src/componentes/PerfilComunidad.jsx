import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import TextoConMenciones from "./TextoConMenciones";
import "./perfilComunidad.css";

function IconoMaterial({ nombre, size = 20 }) {
  return (
    <span
      className="material-symbols-rounded perfil-comunidad-icono"
      style={{ fontSize: `${size}px` }}
      aria-hidden="true"
    >
      {nombre}
    </span>
  );
}

function formatearFecha(fecha) {
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "Ahora";
  const segundos = Math.round((valor.getTime() - Date.now()) / 1000);
  const minutos = Math.round(segundos / 60);
  const horas = Math.round(minutos / 60);
  const dias = Math.round(horas / 24);
  const relativo = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  if (Math.abs(segundos) < 60) return relativo.format(segundos, "second");
  if (Math.abs(minutos) < 60) return relativo.format(minutos, "minute");
  if (Math.abs(horas) < 24) return relativo.format(horas, "hour");
  if (Math.abs(dias) < 7) return relativo.format(dias, "day");
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(valor);
}

function agregarRespuesta(respuestas, nuevaRespuesta, parentId) {
  if (!parentId) return [...respuestas, nuevaRespuesta];
  return respuestas.map((respuesta) => {
    if (respuesta.id === parentId) {
      return { ...respuesta, respuestas: [...(respuesta.respuestas || []), nuevaRespuesta] };
    }
    return {
      ...respuesta,
      respuestas: agregarRespuesta(respuesta.respuestas || [], nuevaRespuesta, parentId),
    };
  });
}

function quitarRespuesta(respuestas, respuestaId) {
  return respuestas
    .filter((respuesta) => respuesta.id !== respuestaId)
    .map((respuesta) => ({
      ...respuesta,
      respuestas: quitarRespuesta(respuesta.respuestas || [], respuestaId),
    }));
}

function Avatar({ autor, compacto = false }) {
  return (
    <span className={`perfil-comunidad-avatar ${compacto ? "compacto" : ""}`} aria-hidden="true">
      {autor?.avatar ? (
        <img src={autor.avatar} alt="" />
      ) : (
        String(autor?.nombre || "S").charAt(0).toUpperCase()
      )}
    </span>
  );
}

export default function PerfilComunidad({
  perfil,
  usuarioActual,
  esPropio = false,
  reelsPropios = [],
  eventosPropios = [],
  onAviso,
}) {
  const navigate = useNavigate();
  const [publicaciones, setPublicaciones] = useState([]);
  const [puedeResponder, setPuedeResponder] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [tipoAdjunto, setTipoAdjunto] = useState("");
  const [adjuntoId, setAdjuntoId] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);
  const [respuestasTexto, setRespuestasTexto] = useState({});
  const [respondiendoA, setRespondiendoA] = useState({});
  const [respondiendoPublicacion, setRespondiendoPublicacion] = useState(null);

  const avisar = useCallback((mensaje) => {
    if (onAviso) onAviso(mensaje);
  }, [onAviso]);

  const obtenerToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const cargarPublicaciones = useCallback(async ({ silencioso = false } = {}) => {
    if (!perfil?.id) {
      setPublicaciones([]);
      setPuedeResponder(false);
      setCargando(false);
      return;
    }

    if (!silencioso) setCargando(true);
    try {
      const token = await obtenerToken();
      const response = await apiRequest(`/api/comunidad-perfil/${encodeURIComponent(perfil.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo cargar la comunidad.");
      setPublicaciones(data.publicaciones || []);
      setPuedeResponder(Boolean(data.puedeResponder));

      const publicacionSolicitada = new URLSearchParams(window.location.search).get("publicacion");
      if (publicacionSolicitada) {
        window.setTimeout(() => {
          document.getElementById(`perfil-comunidad-publicacion-${publicacionSolicitada}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 60);
      }
    } catch (error) {
      console.error(error);
      avisar(error.message || "No se pudo cargar la comunidad.");
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [avisar, obtenerToken, perfil?.id]);

  useEffect(() => {
    cargarPublicaciones();
  }, [cargarPublicaciones]);

  useEffect(() => {
    const actualizar = () => cargarPublicaciones({ silencioso: true });
    window.addEventListener("sondar:comunidad-perfil-actualizada", actualizar);
    return () => window.removeEventListener("sondar:comunidad-perfil-actualizada", actualizar);
  }, [cargarPublicaciones]);

  const opcionesAdjunto = useMemo(() => (
    tipoAdjunto === "reel" ? reelsPropios : eventosPropios
  ), [eventosPropios, reelsPropios, tipoAdjunto]);

  const cambiarTipoAdjunto = (tipo) => {
    setTipoAdjunto((actual) => (actual === tipo ? "" : tipo));
    setAdjuntoId("");
  };

  const publicar = async (event) => {
    event.preventDefault();
    const textoLimpio = texto.trim();
    if (!textoLimpio) return;

    setPublicando(true);
    try {
      const token = await obtenerToken();
      if (!token) throw new Error("Inicia sesion para publicar.");
      const body = { texto: textoLimpio };
      if (tipoAdjunto === "reel" && adjuntoId) body.reelId = Number(adjuntoId);
      if (tipoAdjunto === "evento" && adjuntoId) body.eventoId = Number(adjuntoId);

      const response = await apiRequest("/api/comunidad-perfil/publicaciones", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo publicar.");

      setPublicaciones((actuales) => [data, ...actuales]);
      setTexto("");
      setTipoAdjunto("");
      setAdjuntoId("");
      avisar("Publicacion creada");
    } catch (error) {
      console.error(error);
      avisar(error.message || "No se pudo publicar.");
    } finally {
      setPublicando(false);
    }
  };

  const responder = async (event, publicacionId) => {
    event.preventDefault();
    const textoRespuesta = String(respuestasTexto[publicacionId] || "").trim();
    if (!textoRespuesta) return;

    setRespondiendoPublicacion(publicacionId);
    try {
      const token = await obtenerToken();
      if (!token) throw new Error("Inicia sesion para responder.");
      const parentId = respondiendoA[publicacionId]?.id || null;
      const response = await apiRequest(`/api/comunidad-perfil/publicaciones/${publicacionId}/respuestas`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ texto: textoRespuesta, parentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo responder.");

      setPublicaciones((actuales) => actuales.map((publicacion) => (
        publicacion.id === publicacionId
          ? { ...publicacion, respuestas: agregarRespuesta(publicacion.respuestas || [], data, parentId) }
          : publicacion
      )));
      setRespuestasTexto((actual) => ({ ...actual, [publicacionId]: "" }));
      setRespondiendoA((actual) => ({ ...actual, [publicacionId]: null }));
    } catch (error) {
      console.error(error);
      avisar(error.message || "No se pudo responder.");
    } finally {
      setRespondiendoPublicacion(null);
    }
  };

  const eliminarPublicacion = async (publicacionId) => {
    setBorrandoId(`p-${publicacionId}`);
    try {
      const token = await obtenerToken();
      if (!token) throw new Error("Tu sesion expiro.");
      const response = await apiRequest(`/api/comunidad-perfil/publicaciones/${publicacionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar.");
      setPublicaciones((actuales) => actuales.filter((publicacion) => publicacion.id !== publicacionId));
      avisar("Publicacion eliminada");
    } catch (error) {
      console.error(error);
      avisar(error.message || "No se pudo eliminar.");
    } finally {
      setBorrandoId(null);
    }
  };

  const eliminarRespuesta = async (publicacionId, respuestaId) => {
    setBorrandoId(`r-${respuestaId}`);
    try {
      const token = await obtenerToken();
      if (!token) throw new Error("Tu sesion expiro.");
      const response = await apiRequest(`/api/comunidad-perfil/respuestas/${respuestaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la respuesta.");
      setPublicaciones((actuales) => actuales.map((publicacion) => (
        publicacion.id === publicacionId
          ? { ...publicacion, respuestas: quitarRespuesta(publicacion.respuestas || [], respuestaId) }
          : publicacion
      )));
    } catch (error) {
      console.error(error);
      avisar(error.message || "No se pudo eliminar la respuesta.");
    } finally {
      setBorrandoId(null);
    }
  };

  const abrirAdjunto = (publicacion) => {
    if (publicacion.reel) navigate(`/descubrir?lanzamiento=db-${publicacion.reel.id}`);
    if (publicacion.evento) navigate(`/?evento=${publicacion.evento.id}`);
  };

  const renderRespuesta = (respuesta, publicacionId, nivel = 0) => (
    <div className="perfil-comunidad-respuesta" data-nivel={Math.min(nivel, 2)} key={respuesta.id}>
      <Avatar autor={respuesta.autor} compacto />
      <div>
        <header>
          <strong>{respuesta.autor.nombre}</strong>
          <span>{formatearFecha(respuesta.createdAt)}</span>
        </header>
        <p><TextoConMenciones texto={respuesta.texto} /></p>
        <div className="perfil-comunidad-respuesta-acciones">
          {puedeResponder ? (
            <button
              type="button"
              onClick={() => setRespondiendoA((actual) => ({
                ...actual,
                [publicacionId]: { id: respuesta.id, nombre: respuesta.autor.usuario || respuesta.autor.nombre },
              }))}
            >
              Responder
            </button>
          ) : null}
          {respuesta.autor.id === usuarioActual?.id ? (
            <button
              className="eliminar"
              type="button"
              disabled={borrandoId === `r-${respuesta.id}`}
              onClick={() => eliminarRespuesta(publicacionId, respuesta.id)}
            >
              Eliminar
            </button>
          ) : null}
        </div>
        {(respuesta.respuestas || []).map((hija) => renderRespuesta(hija, publicacionId, nivel + 1))}
      </div>
    </div>
  );

  if (cargando) {
    return (
      <div className="perfil-comunidad-estado" aria-live="polite">
        <IconoMaterial nombre="forum" size={34} />
        <strong>Cargando comunidad...</strong>
      </div>
    );
  }

  return (
    <section className="perfil-comunidad" aria-label={`Comunidad de ${perfil?.nombre || "este perfil"}`}>
      {esPropio && usuarioActual ? (
        <form className="perfil-comunidad-compositor" onSubmit={publicar}>
          <Avatar autor={{ nombre: perfil.nombre, avatar: perfil.avatar }} />
          <div className="perfil-comunidad-compositor-cuerpo">
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Compartir una actualizacion..."
              maxLength={1000}
              rows={3}
              aria-label="Texto de la publicacion"
            />
            <div className="perfil-comunidad-adjuntos">
              <button
                className={tipoAdjunto === "reel" ? "activo" : ""}
                type="button"
                aria-pressed={tipoAdjunto === "reel"}
                onClick={() => cambiarTipoAdjunto("reel")}
              >
                <IconoMaterial nombre="music_note" />
                Reel
              </button>
              <button
                className={tipoAdjunto === "evento" ? "activo" : ""}
                type="button"
                aria-pressed={tipoAdjunto === "evento"}
                onClick={() => cambiarTipoAdjunto("evento")}
              >
                <IconoMaterial nombre="event" />
                Evento
              </button>
            </div>
            {tipoAdjunto ? (
              <div className="perfil-comunidad-selector-adjunto">
                <label htmlFor="perfil-comunidad-adjunto">
                  {tipoAdjunto === "reel" ? "Tu reel" : "Tu evento"}
                </label>
                <select
                  id="perfil-comunidad-adjunto"
                  value={adjuntoId}
                  onChange={(event) => setAdjuntoId(event.target.value)}
                >
                  <option value="">Sin adjunto</option>
                  {opcionesAdjunto.map((item) => (
                    <option key={item.id} value={item.id}>
                      {tipoAdjunto === "reel" ? item.nombre : `${item.nombre} - ${item.detalle || "Evento"}`}
                    </option>
                  ))}
                </select>
                <button type="button" aria-label="Quitar selector de adjunto" title="Quitar adjunto" onClick={() => cambiarTipoAdjunto(tipoAdjunto)}>
                  <IconoMaterial nombre="close" />
                </button>
              </div>
            ) : null}
            <footer>
              <span>{texto.length}/1000</span>
              <button type="submit" disabled={publicando || !texto.trim()}>
                <IconoMaterial nombre="send" />
                {publicando ? "Publicando..." : "Publicar"}
              </button>
            </footer>
          </div>
        </form>
      ) : null}

      {publicaciones.length === 0 ? (
        <div className="perfil-comunidad-estado">
          <IconoMaterial nombre="forum" size={34} />
          <strong>Todavia no hay publicaciones.</strong>
        </div>
      ) : (
        <div className="perfil-comunidad-feed">
          {publicaciones.map((publicacion) => (
            <article
              className="perfil-comunidad-publicacion"
              id={`perfil-comunidad-publicacion-${publicacion.id}`}
              key={publicacion.id}
            >
              <Avatar autor={publicacion.autor} />
              <div className="perfil-comunidad-publicacion-cuerpo">
                <header className="perfil-comunidad-publicacion-header">
                  <div>
                    <strong>{publicacion.autor.nombre}</strong>
                    <span>{publicacion.autor.usuario}</span>
                    <time dateTime={publicacion.createdAt}>{formatearFecha(publicacion.createdAt)}</time>
                  </div>
                  {publicacion.origen !== "manual" ? (
                    <span className="perfil-comunidad-actividad">Actividad</span>
                  ) : null}
                  {publicacion.autor.id === usuarioActual?.id ? (
                    <button
                      type="button"
                      aria-label="Eliminar publicacion"
                      title="Eliminar publicacion"
                      disabled={borrandoId === `p-${publicacion.id}`}
                      onClick={() => eliminarPublicacion(publicacion.id)}
                    >
                      <IconoMaterial nombre="delete" />
                    </button>
                  ) : null}
                </header>
                <p className="perfil-comunidad-texto"><TextoConMenciones texto={publicacion.texto} /></p>

                {publicacion.reel || publicacion.evento ? (
                  <button className="perfil-comunidad-adjunto" type="button" onClick={() => abrirAdjunto(publicacion)}>
                    <span className="perfil-comunidad-adjunto-imagen">
                      {publicacion.reel?.portada ? (
                        <img src={publicacion.reel.portada} alt="" />
                      ) : (
                        <img className="logo" src="/sondar-icon.png?v=19" alt="" />
                      )}
                    </span>
                    <span>
                      <small>{publicacion.reel ? "REEL" : "EVENTO"}</small>
                      <strong>{publicacion.reel?.titulo || publicacion.evento?.lugar || "Evento SONDAR"}</strong>
                      <em>
                        {publicacion.reel
                          ? (publicacion.reel.generos || []).join(" / ") || publicacion.reel.genero || "Preview musical"
                          : `${(publicacion.evento.generos || []).join(" / ") || publicacion.evento.genero || "Evento"} - ${new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(publicacion.evento.fecha))}`}
                      </em>
                    </span>
                    <IconoMaterial nombre="arrow_outward" />
                  </button>
                ) : null}

                <div className="perfil-comunidad-respuestas">
                  {(publicacion.respuestas || []).map((respuesta) => renderRespuesta(respuesta, publicacion.id))}
                </div>

                {puedeResponder ? (
                  <form className="perfil-comunidad-responder" onSubmit={(event) => responder(event, publicacion.id)}>
                    {respondiendoA[publicacion.id] ? (
                      <div className="perfil-comunidad-respondiendo">
                        <span>Respondiendo a {respondiendoA[publicacion.id].nombre}</span>
                        <button
                          type="button"
                          aria-label="Cancelar respuesta citada"
                          onClick={() => setRespondiendoA((actual) => ({ ...actual, [publicacion.id]: null }))}
                        >
                          <IconoMaterial nombre="close" size={18} />
                        </button>
                      </div>
                    ) : null}
                    <div>
                      <input
                        type="text"
                        value={respuestasTexto[publicacion.id] || ""}
                        onChange={(event) => setRespuestasTexto((actual) => ({
                          ...actual,
                          [publicacion.id]: event.target.value,
                        }))}
                        placeholder="Responder..."
                        maxLength={800}
                        aria-label="Responder a la publicacion"
                      />
                      <button
                        type="submit"
                        aria-label="Enviar respuesta"
                        title="Enviar respuesta"
                        disabled={respondiendoPublicacion === publicacion.id || !String(respuestasTexto[publicacion.id] || "").trim()}
                      >
                        <IconoMaterial nombre="send" />
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
