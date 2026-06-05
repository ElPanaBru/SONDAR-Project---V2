import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./eventos.css";
import L from "leaflet";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

const GENEROS_PERMITIDOS = [
  "pop", "rock", "edm", "jazz", "blues",
  "cumbia", "trap", "metal", "folklore", "otros"
];

const normalizarGenero = (genero) => {
  const gen = genero ? genero.toLowerCase() : "otros";
  return GENEROS_PERMITIDOS.includes(gen) ? gen : "otros";
};

const escaparHtml = (valor) =>
  String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export default function Eventos({ usuario }) {
  // Referencias para el mapa principal
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const avisoTimer = useRef(null);
  
  // Referencias para el MINI MAPA del modal (Picker)
  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const miniMarkerRef = useRef(null);

  // Estados de UI y Filtros
  const [eventoActivo, setEventoActivo] = useState(null);
  const [ultimoEventoDetalle, setUltimoEventoDetalle] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("todos");
  const [aviso, setAviso] = useState("");

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
        const res = await fetch(apiUrl("/api/eventos"));
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
  }, []);

  const eventoSeleccionado = useMemo(
    () => eventos.find((evento) => evento.id === eventoActivo),
    [eventos, eventoActivo]
  );

  const detalleEvento = eventoSeleccionado || ultimoEventoDetalle;

  const eventosFiltrados = useMemo(
    () => eventos.filter((evento) =>
      filtroGenero === "todos" ? true : normalizarGenero(evento.genero) === filtroGenero
    ),
    [eventos, filtroGenero]
  );

  // 2. Inicialización del Mapa Principal (Modo Oscuro)
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([-34.6037, -58.3816], 12);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
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

  // 3. Inicialización del MINI MAPA (Clásico/Ordinario y grande)
  useEffect(() => {
    if (!mostrarModal || !miniMapRef.current) return;

    if (miniMapInstance.current) {
      miniMapInstance.current.remove();
      miniMapInstance.current = null;
    }

    const { lat, lng } = coordsInicialesRef.current;

    const miniMap = L.map(miniMapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 14); // Buen nivel de zoom para ver alturas de calles al abrir

    // Capas claras de OpenStreetMap para máxima lectura de calles y plazas
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(miniMap);

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
    const coordenadasUsadas = {};

    eventosFiltrados.forEach((evento) => {
      if (!evento.coords || isNaN(evento.coords[0]) || isNaN(evento.coords[1])) return;

      let lat = evento.coords[0];
      let lng = evento.coords[1];
      const claveCoordenada = `${lat.toFixed(4)},${lng.toFixed(4)}`;

      if (coordenadasUsadas[claveCoordenada]) {
        lat += (Math.random() - 0.5) * 0.0012;
        lng += (Math.random() - 0.5) * 0.0012;
      } else {
        coordenadasUsadas[claveCoordenada] = true;
      }

      const posicionFinal = [lat, lng];
      const activo = eventoActivo === evento.id;
      const imagenEvento = evento.img || evento.img_url || "/logo.png";

      const marker = L.marker(posicionFinal, {
        icon: L.divIcon({
          className: "evento-pin-wrapper",
          html: `
            <button class="evento-pin ${activo ? "activo" : ""}" type="button" aria-label="${escaparHtml(evento.titulo)}">
              <span class="evento-pin-pulse">
                <img src="${escaparHtml(imagenEvento)}" alt="" />
              </span>
              <strong>${escaparHtml(evento.titulo)}</strong>
            </button>
          `,
          iconSize: [132, 82],
          iconAnchor: [66, 41]
        })
      });

      marker.on("click", () => {
        setUltimoEventoDetalle(evento);
        setEventoActivo(evento.id);
        mapInstance.current.flyTo(posicionFinal, 16, { duration: 0.9 });
      });

      marker.addTo(markersLayer.current);
    });
  }, [eventosFiltrados, eventoActivo]);

  // 5. Encuadre automático del mapa principal
  useEffect(() => {
    if (!mapInstance.current || eventosFiltrados.length === 0) return;
    
    const coordsValidas = eventosFiltrados
      .filter(ev => ev.coords && !isNaN(ev.coords[0]) && !isNaN(ev.coords[1]))
      .map(ev => ev.coords);

    if (coordsValidas.length === 0) return;

    const bounds = L.latLngBounds(coordsValidas);
    mapInstance.current.fitBounds(bounds, {
      padding: [90, 90],
      maxZoom: 13,
      animate: true
    });
  }, [eventosFiltrados]);

  // Funciones Auxiliares de UI
  const toggleGuardar = (id) => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para guardar eventos");
      return;
    }
    setEventos(eventos.map((evento) =>
      evento.id === id ? { ...evento, guardado: !evento.guardado } : evento
    ));
  };

  const handleCrearEvento = () => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }
    setMostrarModal(true);
  };

  const mostrarAviso = (mensaje) => {
    clearTimeout(avisoTimer.current);
    setAviso(mensaje);
    avisoTimer.current = setTimeout(() => {
      setAviso("");
    }, 2400);
  };

  const handleFiltroGenero = (genero) => {
    setFiltroGenero(genero);
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

  const formatearFecha = (fecha, hora) => {
    if (!fecha || !hora) return "";
    const fechaObj = new Date(`${fecha}T${hora}`);
    return fechaObj.toISOString();
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

      setNuevoEvento({
        titulo: "", genero: "", lugar: "", fecha: "", hora: "", link: "", imagen: null, nombreImagen: "", lat: -34.6037, lng: -58.3816
      });

      mostrarAviso("¡Evento creado con éxito!");

    } catch (error) {
      console.error(error);
      mostrarAviso("Hubo un error al guardar el evento.");
    } finally {
      setSubiendo(false);
    }
  };
  return (
    <div className="eventos-container">
      <div ref={mapRef} className="eventos-mapa" aria-label="Mapa de eventos"></div>

      <div className="eventos-panel">
        <div className="eventos-header">
          <div>
            <span className="eventos-eyebrow">Sondar</span>
            <h2>Eventos cerca tuyo</h2>
          </div>

          <div className="eventos-acciones">
            <label>
              <span>Genero</span>
              <select
                className="eventos-filtro"
                value={filtroGenero}
                onChange={(e) => handleFiltroGenero(e.target.value)}
              >
                <option value="todos">Todos</option>
                {GENEROS_PERMITIDOS.map((genero) => (
                  <option key={genero} value={genero}>{genero}</option>
                ))}
              </select>
            </label>
            <button className="btn-crear-evento" onClick={handleCrearEvento}>
              Crear Evento
            </button>
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

            <div
              className="evento-detalle-imagen"
              style={{ backgroundImage: `url(${detalleEvento.img || detalleEvento.img_url || "/logo.png"})` }}
            >
              <span>{detalleEvento.genero || "general"}</span>
            </div>

            <div className="evento-detalle-info">
              <span className="eventos-eyebrow">Evento seleccionado</span>
              <h3>{detalleEvento.titulo}</h3>
              <p>{detalleEvento.lugar}</p>
              <p>{detalleEvento.fecha}</p>
              <p className="evento-creador">{detalleEvento.creador || "Anonimo"}</p>

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
          <div className="evento-modal">
            <h2>Crear Evento</h2>

            <form onSubmit={handleSubmit}>
              <input type="text" name="titulo" placeholder="Nombre del evento" value={nuevoEvento.titulo} onChange={handleChange} required />

              <input
                list="generos-lista"
                name="genero"
                placeholder="Genero"
                value={nuevoEvento.genero}
                onChange={handleChange}
                required
              />
              <datalist id="generos-lista">
                {GENEROS_PERMITIDOS.map((genero) => (
                  <option key={genero} value={genero} />
                ))}
              </datalist>

              <label className="evento-file-selector">
                <span>Seleccionar imagen</span>
                <strong>{nuevoEvento.nombreImagen || "Sin archivo"}</strong>
                <input type="file" accept="image/*" onChange={handleImagen} />
              </label>

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
              <input type="url" name="link" placeholder="URL de compra (opcional)" value={nuevoEvento.link} onChange={handleChange} />

              <div className="evento-modal-botones">
                <button type="submit" disabled={subiendo}>
                  {subiendo ? "Guardando..." : "Crear"}
                </button>
                <button type="button" onClick={() => setMostrarModal(false)} disabled={subiendo}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
