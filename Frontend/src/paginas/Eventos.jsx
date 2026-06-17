import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./eventos.css";
import L from "leaflet";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

const GENEROS_PERMITIDOS = [
  "pop", "rock", "edm", "jazz", "blues",
  "cumbia", "trap", "metal", "folklore", "otros"
];

const DURACION_ACERCAMIENTO_MAPA = 0.8;
const SUAVIDAD_ACERCAMIENTO_MAPA = 0.25;

const normalizarGenero = (genero) => {
  const gen = genero?.trim().toLowerCase() || "otros";
  return GENEROS_PERMITIDOS.includes(gen) ? gen : "otros";
};

const mostrarGenero = (genero) => {
  const valor = normalizarGenero(genero);
  return valor === "edm" ? "EDM" : valor.charAt(0).toUpperCase() + valor.slice(1);
};

const escaparHtml = (valor) =>
  String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const acercarMapaABounds = (mapa, bounds, maxZoom) => {
  const zoomDestino = Math.min(
    mapa.getBoundsZoom(bounds, false, L.point(180, 180)),
    maxZoom
  );

  mapa.flyTo(bounds.getCenter(), zoomDestino, {
    duration: DURACION_ACERCAMIENTO_MAPA,
    easeLinearity: SUAVIDAD_ACERCAMIENTO_MAPA,
  });
};

export default function Eventos({ usuario }) {
  const [searchParams] = useSearchParams();
  const eventoCompartido = searchParams.get("evento");
  const crearEventoParam = searchParams.get("crear");
  // Referencias para el mapa principal
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const avisoTimer = useRef(null);
  
  // Referencias para el MINI MAPA del modal (Picker)
  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const miniMarkerRef = useRef(null);
  const imagenEventoInputRef = useRef(null);

  // Estados de UI y Filtros
  const [eventoActivo, setEventoActivo] = useState(null);
  const [ultimoEventoDetalle, setUltimoEventoDetalle] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("todos");
  const [aviso, setAviso] = useState("");
  const [zoomMapa, setZoomMapa] = useState(12);
  const [menuEventoAbierto, setMenuEventoAbierto] = useState(false);

  // Estados de Datos y Carga
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);

  // Estado del nuevo evento
  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: "",
    genero: "",
    lugar: "", 
    fecha: "",
    hora: "",
    precio: "",
    link: "",
    imagen: null,
    nombreImagen: "",
    lat: -34.6037, 
    lng: -58.3816
  });

  const coordsInicialesRef = useRef({ lat: -34.6037, lng: -58.3816 });

  // 1. Carga inicial de eventos desde el Backend
  useEffect(() => {
    let isMounted = true;
    const cargarEventos = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const res = await fetch(apiUrl("/api/eventos"), {
          headers: token
            ? {
                Authorization: `Bearer ${token}`
              }
            : undefined
        });
        if (res.ok) {
          const data = await res.json();
          const eventosMapeados = data.map(ev => ({
            ...ev,
            img: ev.img || ev.img_url,
            coords: [parseFloat(ev.latitud), parseFloat(ev.longitud)]
          }));
          
          if (isMounted) {
            setEventos(eventosMapeados);
            setLoading(false);
          }
        } else {
          console.error("Error al traer eventos del servidor");
          if (isMounted) setLoading(false);
        }
      } catch (error) {
        console.error("Error de red:", error);
        if (isMounted) setLoading(false);
      }
    };

    cargarEventos();
    return () => { isMounted = false; };
  }, [usuario?.id]);

  const eventoSeleccionado = useMemo(
    () => eventos.find((evento) => evento.id === eventoActivo),
    [eventos, eventoActivo]
  );

  const detalleEvento = eventoSeleccionado || ultimoEventoDetalle;

  useEffect(() => {
    setMenuEventoAbierto(false);
  }, [eventoActivo]);

  const eventosFiltrados = useMemo(
    () => eventos.filter((evento) => {
      const genero = normalizarGenero(evento.genero);
      return filtroGenero === "todos" || genero === filtroGenero;
    }),
    [eventos, filtroGenero]
  );

  // 2. Inicialización del Mapa Principal (Modo Oscuro)
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1
    }).setView([-34.6037, -58.3816], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      noWrap: true,
      bounds: [[-85, -180], [85, 180]]
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("zoomend", () => setZoomMapa(map.getZoom()));
    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
      markersLayer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loading && mapInstance.current) {
      setTimeout(() => {
        mapInstance.current.invalidateSize();
      }, 100);
    }
  }, [loading]);

  useEffect(() => {
    if (!eventoCompartido || loading || eventos.length === 0) return;
    const eventoDestino = eventos.find((evento) => String(evento.id) === String(eventoCompartido));
    if (!eventoDestino) return;

    setUltimoEventoDetalle(eventoDestino);
    setEventoActivo(eventoDestino.id);
    if (eventoDestino.coords && mapInstance.current) {
      mapInstance.current.flyTo(eventoDestino.coords, 16, {
        duration: DURACION_ACERCAMIENTO_MAPA,
        easeLinearity: SUAVIDAD_ACERCAMIENTO_MAPA,
      });
    }
  }, [eventoCompartido, eventos, loading]);

  useEffect(() => {
    if (crearEventoParam !== "evento") return;
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }
    setMostrarModal(true);
  }, [crearEventoParam, usuario]);

  // 3. Inicialización del MINI MAPA (Clásico/Ordinario y grande)
  useEffect(() => {
    if (!mostrarModal || !miniMapRef.current) return;

    if (miniMapInstance.current) {
      miniMapInstance.current.remove();
      miniMapInstance.current = null;
    }

    const { lat, lng } = coordsInicialesRef.current;

    const miniMap = L.map(miniMapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([lat, lng], 14); // Buen nivel de zoom para ver alturas de calles al abrir

    // Capas claras de OpenStreetMap para máxima lectura de calles y plazas
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(miniMap);

    L.control.zoom({ position: "bottomleft" }).addTo(miniMap);

    const pin = L.marker([lat, lng], {
      draggable: true
    }).addTo(miniMap);

    miniMarkerRef.current = pin;
    miniMapInstance.current = miniMap;

    // Redibujado seguro contemplando el nuevo tamaño del modal
    setTimeout(() => {
      miniMap.invalidateSize();
    }, 250);

    pin.on("dragend", () => {
      const posicion = pin.getLatLng();
      setNuevoEvento(prev => ({ ...prev, lat: posicion.lat, lng: posicion.lng }));
    });

    miniMap.on("click", (e) => {
      pin.setLatLng(e.latlng);
      setNuevoEvento(prev => ({ ...prev, lat: e.latlng.lat, lng: e.latlng.lng }));
    });

    return () => {
      if (miniMapInstance.current) {
        miniMapInstance.current.remove();
        miniMapInstance.current = null;
      }
    };
  }, [mostrarModal]);

  // 4. Renderizado de Marcadores en el Mapa Principal
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();
    const map = mapInstance.current;
    const eventosValidos = eventosFiltrados.filter(
      (evento) => evento.coords && !isNaN(evento.coords[0]) && !isNaN(evento.coords[1])
    );
    const distanciaAgrupacion = zoomMapa >= 15 ? 34 : zoomMapa >= 12 ? 58 : 82;
    const grupos = [];

    eventosValidos.forEach((evento) => {
      const punto = map.project(evento.coords, zoomMapa);
      const grupoCercano = grupos.find((grupo) => grupo.punto.distanceTo(punto) < distanciaAgrupacion);

      if (grupoCercano) {
        grupoCercano.eventos.push(evento);
        const cantidad = grupoCercano.eventos.length;
        grupoCercano.punto = L.point(
          (grupoCercano.punto.x * (cantidad - 1) + punto.x) / cantidad,
          (grupoCercano.punto.y * (cantidad - 1) + punto.y) / cantidad
        );
      } else {
        grupos.push({ eventos: [evento], punto });
      }
    });

    grupos.forEach((grupo) => {
      if (grupo.eventos.length > 1) {
        const posicionGrupo = map.unproject(grupo.punto, zoomMapa);
        const cluster = L.marker(posicionGrupo, {
          icon: L.divIcon({
            className: "evento-cluster-wrapper",
            html: `<button class="evento-cluster" type="button" aria-label="${grupo.eventos.length} eventos cercanos">${grupo.eventos.length}</button>`,
            iconSize: [52, 52],
            iconAnchor: [26, 26]
          })
        });

        cluster.on("click", () => {
        const bounds = L.latLngBounds(grupo.eventos.map((evento) => evento.coords));
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.flyTo(bounds.getCenter(), Math.min(zoomMapa + 2, 18), {
            duration: DURACION_ACERCAMIENTO_MAPA,
            easeLinearity: SUAVIDAD_ACERCAMIENTO_MAPA,
          });
        } else {
          acercarMapaABounds(map, bounds, 17);
        }
        });

        cluster.addTo(markersLayer.current);
        return;
      }

      const evento = grupo.eventos[0];
      const posicionFinal = evento.coords;
      const activo = eventoActivo === evento.id;
      const imagenEvento = evento.img || evento.img_url || "/logo.png";
      const compacto = zoomMapa <= 11;

      const marker = L.marker(posicionFinal, {
        icon: L.divIcon({
          className: "evento-pin-wrapper",
          html: `
            <button class="evento-pin ${activo ? "activo" : ""} ${compacto ? "compacto" : ""}" type="button" aria-label="${escaparHtml(evento.titulo)}" title="${escaparHtml(evento.titulo)}">
              <span class="evento-pin-pulse">
                <img src="${escaparHtml(imagenEvento)}" alt="" />
              </span>
              <strong>${escaparHtml(evento.titulo)}</strong>
            </button>
          `,
          iconSize: [150, 92],
          iconAnchor: [75, 46]
        })
      });

      marker.on("click", () => {
        setUltimoEventoDetalle(evento);
        setEventoActivo(evento.id);
      mapInstance.current.flyTo(posicionFinal, 16, {
        duration: DURACION_ACERCAMIENTO_MAPA,
        easeLinearity: SUAVIDAD_ACERCAMIENTO_MAPA,
      });
      });

      marker.addTo(markersLayer.current);
    });
  }, [eventosFiltrados, eventoActivo, zoomMapa]);

  // 5. Encuadre automático del mapa principal
  useEffect(() => {
    if (!mapInstance.current || eventosFiltrados.length === 0) return;
    
    const coordsValidas = eventosFiltrados
      .filter(ev => ev.coords && !isNaN(ev.coords[0]) && !isNaN(ev.coords[1]))
      .map(ev => ev.coords);

    if (coordsValidas.length === 0) return;

    const bounds = L.latLngBounds(coordsValidas);
   acercarMapaABounds(mapInstance.current, bounds, 13);
  }, [eventosFiltrados]);

  // Funciones Auxiliares de UI
  const toggleGuardar = async (id) => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para guardar eventos");
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

      const response = await fetch(apiUrl(`/api/eventos/${id}/guardar`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el evento.");
      }

      const dataGuardado = await response.json();
      setEventos((actuales) => actuales.map((evento) =>
        evento.id === id ? { ...evento, guardado: dataGuardado.guardado } : evento
      ));
      setUltimoEventoDetalle((actual) =>
        actual?.id === id ? { ...actual, guardado: dataGuardado.guardado } : actual
      );
    } catch (error) {
      console.error(error);
      mostrarAviso(error.message || "No se pudo actualizar el guardado.");
    }
  };

  const usuarioPuedeEliminarEvento = (evento) =>
    Boolean(
      usuario &&
      (evento?.creador_id === usuario.id ||
        evento?.creadorId === usuario.id ||
        (usuario?.email && evento?.creador === usuario.email))
    );

  const eliminarEvento = async (evento) => {
    if (!usuarioPuedeEliminarEvento(evento)) return;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

      const response = await fetch(apiUrl(`/api/eventos/${evento.id}`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo eliminar el evento.");
      }

      setEventos((actuales) => actuales.filter((item) => item.id !== evento.id));
      setEventoActivo(null);
      setUltimoEventoDetalle(null);
      setMenuEventoAbierto(false);
      mostrarAviso("Evento eliminado");
    } catch (error) {
      console.error(error);
      mostrarAviso("Hubo un error al eliminar el evento.");
    }
  };

  const handleCrearEvento = () => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }
    setMostrarModal(true);
  };

  useEffect(() => {
    const abrirDesdeSidebar = () => handleCrearEvento();
    window.addEventListener("sondar:crear-evento", abrirDesdeSidebar);
    return () => window.removeEventListener("sondar:crear-evento", abrirDesdeSidebar);
  });

  const mostrarAviso = (mensaje) => {
    clearTimeout(avisoTimer.current);
    setAviso(mensaje);
    avisoTimer.current = setTimeout(() => {
      setAviso("");
    }, 2400);
  };

  const handleFiltroGenero = (genero) => {
    setFiltroGenero(genero);
    setMenuEventoAbierto(false);
    if (!eventoSeleccionado) return;
    const activoVisible = genero === "todos" || normalizarGenero(eventoSeleccionado.genero) === genero;
    if (!activoVisible) {
      setEventoActivo(null);
    }
  };

  const handleChange = (e) => {
    setNuevoEvento({
      ...nuevoEvento,
      [e.target.name]: e.target.value
    });
  };

const handleImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Guardamos el objeto File directo (mucho más liviano)
    setNuevoEvento((prev) => ({
      ...prev,
      imagen: file,
      nombreImagen: file.name
    }));
  };

  const limpiarImagenEvento = () => {
    if (imagenEventoInputRef.current) imagenEventoInputRef.current.value = "";
    setNuevoEvento((prev) => ({
      ...prev,
      imagen: null,
      nombreImagen: ""
    }));
  };

  const formatearFecha = (fecha, hora) => {
    if (!fecha || !hora) return "";
    const fechaObj = new Date(`${fecha}T${hora}`);
    return fechaObj.toISOString();
  };

  const formatearFechaVisible = (fecha) => {
    if (!fecha) return "Sin fecha";

    const valor = new Date(fecha);
    if (Number.isNaN(valor.getTime())) return fecha;

    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(valor);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }

    setSubiendo(true);

    const formData = new FormData();
    formData.append("titulo", nuevoEvento.titulo);
    formData.append("genero", normalizarGenero(nuevoEvento.genero));
    formData.append("ubicacion", nuevoEvento.lugar);
    formData.append("fecha", formatearFecha(nuevoEvento.fecha, nuevoEvento.hora));
    formData.append("precio", nuevoEvento.precio);
    formData.append("link", nuevoEvento.link);
    formData.append("latitud", nuevoEvento.lat);
    formData.append("longitud", nuevoEvento.lng);

    if (nuevoEvento.imagen) {
      formData.append("imagen", nuevoEvento.imagen);
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

      const response = await fetch(apiUrl("/api/eventos/crear"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el evento en el servidor.");
      }

      const eventoGuardado = await response.json();
      
      const eventoParaMapa = {
        ...eventoGuardado,
        img: eventoGuardado.img || eventoGuardado.img_url,
        coords: [parseFloat(eventoGuardado.latitud), parseFloat(eventoGuardado.longitud)]
      };

      setEventos([eventoParaMapa, ...eventos]);
      setUltimoEventoDetalle(eventoParaMapa);
      setEventoActivo(eventoParaMapa.id);
      
      setMostrarModal(false);
      if (imagenEventoInputRef.current) imagenEventoInputRef.current.value = "";

      setNuevoEvento({
        titulo: "", genero: "", lugar: "", fecha: "", hora: "", precio: "", link: "", imagen: null, nombreImagen: "", lat: -34.6037, lng: -58.3816
      });

      mostrarAviso("¡Evento creado con éxito!");

    } catch (error) {
      console.error(error);
      mostrarAviso(error.message || "Hubo un error al guardar el evento.");
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <div className={`eventos-container ${eventoSeleccionado ? "detalle-abierto" : ""}`}>
      <div ref={mapRef} className="eventos-mapa" aria-label="Mapa de eventos"></div>

      <div className="eventos-panel">
        <div className="eventos-header">
          <div className="eventos-titulo">
            <h2>Eventos cerca tuyo</h2>
            <label className="eventos-genero">
              <span>Genero</span>
              <select
                className="eventos-filtro"
                value={filtroGenero}
                onChange={(e) => handleFiltroGenero(e.target.value)}
              >
                <option value="todos">Todos</option>
                {GENEROS_PERMITIDOS.map((genero) => (
                  <option key={genero} value={genero}>{mostrarGenero(genero)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ position: "absolute", zIndex: 1000, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.8)", padding: "1rem 2rem", borderRadius: "8px", color: "white" }}>
          Cargando mapa y eventos...
        </div>
      )}

      {!loading && eventosFiltrados.length === 0 && (
        <div className="eventos-vacio">
          No hay eventos de este genero
        </div>
      )}

      {aviso && (
        <div className="eventos-toast" role="status">
          {aviso}
        </div>
      )}

      <aside className={`evento-detalle ${eventoSeleccionado ? "abierto" : ""}`} aria-live="polite">
        {detalleEvento && (
          <>
            <button className="evento-detalle-cerrar" type="button" onClick={() => setEventoActivo(null)}>
              Cerrar
            </button>

            {usuarioPuedeEliminarEvento(detalleEvento) ? (
              <div className="evento-detalle-menu">
                <button
                  className="evento-detalle-menu-btn"
                  type="button"
                  aria-label="Opciones del evento"
                  aria-expanded={menuEventoAbierto}
                  onClick={() => setMenuEventoAbierto((actual) => !actual)}
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </button>
                {menuEventoAbierto ? (
                  <div className="evento-detalle-menu-popover">
                    <button type="button" onClick={() => eliminarEvento(detalleEvento)}>
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className="evento-detalle-imagen"
              style={{ backgroundImage: `url(${detalleEvento.img || detalleEvento.img_url || "/logo.png"})` }}
            >
              <span>{mostrarGenero(detalleEvento.genero)}</span>
            </div>

            <div className="evento-detalle-info">
              <span className="eventos-eyebrow">Evento seleccionado</span>
              <h3>{detalleEvento.titulo}</h3>
              <dl className="evento-detalle-datos">
                <div>
                  <dt>Lugar</dt>
                  <dd>{detalleEvento.lugar || detalleEvento.ubicacion || "Sin especificar"}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{formatearFechaVisible(detalleEvento.fecha)}</dd>
                </div>
                <div>
                  <dt>Organiza</dt>
                  <dd>{detalleEvento.creador || "Anonimo"}</dd>
                </div>
              </dl>
              {detalleEvento.precio !== null && detalleEvento.precio !== undefined && detalleEvento.precio !== "" ? (
                <p>Entrada: ${Number(detalleEvento.precio).toLocaleString("es-AR")}</p>
              ) : null}

              <div className="evento-detalle-acciones">
                <button
                  className="btn-like"
                  aria-label={detalleEvento.guardado ? "Quitar guardado" : "Guardar evento"}
                  onClick={() => toggleGuardar(detalleEvento.id)}
                >
                  {detalleEvento.guardado ? "Guardado" : "Guardar"}
                </button>

                {detalleEvento.link && (
                  <a
                    href={detalleEvento.link}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-comprar"
                  >
                    Comprar
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {mostrarModal && (
        <div className="evento-modal-overlay">
          <section className="evento-modal" role="dialog" aria-modal="true" aria-labelledby="crear-evento-titulo" onMouseDown={(event) => event.stopPropagation()}>
            <header className="evento-modal-header">
              <div>
                <span>EVENTOS</span>
                <h2 id="crear-evento-titulo">Crear nuevo evento</h2>
              </div>
              <button className="evento-modal-volver" type="button" onClick={() => setMostrarModal(false)} disabled={subiendo} aria-label="Cerrar creador de evento">
                <svg aria-hidden="true" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                </svg>
              </button>
            </header>

            <form id="crear-evento-form" className="evento-modal-form" onSubmit={handleSubmit}>
              <input type="text" name="titulo" placeholder="Nombre del evento" value={nuevoEvento.titulo} onChange={handleChange} required />

            <select
              name="genero"
              value={nuevoEvento.genero}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Seleccionar genero</option>
              {GENEROS_PERMITIDOS.map((genero) => (
                <option key={genero} value={genero}>{mostrarGenero(genero)}</option>
              ))}
            </select>

              <label className="evento-file-selector">
                <span>Seleccionar imagen</span>
                <strong>{nuevoEvento.nombreImagen || "Sin archivo"}</strong>
                <input ref={imagenEventoInputRef} type="file" accept="image/*" onChange={handleImagen} />
              </label>
              {nuevoEvento.nombreImagen ? (
                <button className="evento-file-clear" type="button" onClick={limpiarImagenEvento}>
                  Quitar imagen
                </button>
              ) : null}

              <input
                type="text"
                name="lugar"
                placeholder="Nombre del lugar (Ej: Niceto Club, Palermo)"
                value={nuevoEvento.lugar}
                onChange={handleChange}
                required
              />

              <div className="mini-mapa-instruccion">
                Hacé click en el mapa o arrastrá el pin para ubicar el evento:
              </div>
              
              {/* Refactorizado con la nueva clase CSS limpia */}
              <div ref={miniMapRef} className="evento-minimapa"></div>

              <input type="date" name="fecha" value={nuevoEvento.fecha} onChange={handleChange} required />
              <input type="time" name="hora" value={nuevoEvento.hora} onChange={handleChange} required />
              <input
                type="number"
                name="precio"
                min="0"
                step="0.01"
                placeholder="Precio de entrada (opcional)"
                value={nuevoEvento.precio}
                onChange={handleChange}
              />
              <input type="url" name="link" placeholder="URL de compra (opcional)" value={nuevoEvento.link} onChange={handleChange} />

              <button className="evento-modal-publicar" type="submit" disabled={subiendo}>
                {subiendo ? "Guardando..." : "Crear evento"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
