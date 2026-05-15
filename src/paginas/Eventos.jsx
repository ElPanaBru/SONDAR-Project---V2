import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./eventos.css";
import L from "leaflet";

const GENEROS_PERMITIDOS = [
  "pop", "rock", "edm", "jazz", "blues",
  "cumbia", "trap", "metal", "folklore", "otros"
];

const normalizarGenero = (genero) => {
  const gen = genero.toLowerCase();
  return GENEROS_PERMITIDOS.includes(gen) ? gen : "otros";
};

const escaparHtml = (valor) =>
  String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

export default function Eventos({ usuario }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const avisoTimer = useRef(null);
  const siguienteEventoId = useRef(5);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [ultimoEventoDetalle, setUltimoEventoDetalle] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("todos");
  const [aviso, setAviso] = useState("");

  const [eventos, setEventos] = useState([
    {
      id: 1,
      titulo: "RAICES ROCK",
      lugar: "Niceto Club, Palermo",
      fecha: "29/04/2026 22:00",
      genero: "rock",
      coords: [-34.6037, -58.3816],
      img: "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2",
      link: "https://www.ticketek.com.ar",
      guardado: false,
      creador: "demo@gmail.com"
    },
    {
      id: 2,
      titulo: "S.A. punk",
      lugar: "El Emergente, Almagro",
      fecha: "30/04/2026 21:00",
      genero: "metal",
      coords: [-34.5883, -58.43],
      img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
      link: "",
      guardado: false,
      creador: "demo@gmail.com"
    },
    {
      id: 3,
      titulo: "CasaMadre",
      lugar: "La Trastienda, San Telmo",
      fecha: "02/05/2026 20:30",
      genero: "rock",
      coords: [-34.6215, -58.3713],
      img: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
      link: "https://www.ticketek.com.ar",
      guardado: false,
      creador: "sondar@demo.com"
    },
    {
      id: 4,
      titulo: "Marte Miente",
      lugar: "Makena, Palermo",
      fecha: "08/05/2026 23:00",
      genero: "trap",
      coords: [-34.5802, -58.4245],
      img: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
      link: "",
      guardado: false,
      creador: "sondar@demo.com"
    }
  ]);

  const [nuevoEvento, setNuevoEvento] = useState({
    titulo: "",
    genero: "",
    ubicacion: "",
    fecha: "",
    hora: "",
    link: "",
    imagen: null,
    nombreImagen: ""
  });

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

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapInstance.current = null;
      markersLayer.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(avisoTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();

    eventosFiltrados.forEach((evento) => {
      const activo = eventoActivo === evento.id;
      const marker = L.marker(evento.coords, {
        icon: L.divIcon({
          className: "evento-pin-wrapper",
          html: `
            <button class="evento-pin ${activo ? "activo" : ""}" type="button" aria-label="${escaparHtml(evento.titulo)}">
              <span class="evento-pin-pulse">
                <img src="${escaparHtml(evento.img)}" alt="" />
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
        mapInstance.current.flyTo(evento.coords, 16, { duration: 0.9 });
      });

      marker.addTo(markersLayer.current);
    });
  }, [eventosFiltrados, eventoActivo]);

  useEffect(() => {
    if (!mapInstance.current || eventosFiltrados.length === 0) return;

    const bounds = L.latLngBounds(eventosFiltrados.map((evento) => evento.coords));
    mapInstance.current.fitBounds(bounds, {
      padding: [90, 90],
      maxZoom: 13,
      animate: true
    });
  }, [eventosFiltrados]);

  const geocodificarDireccion = async (direccion) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`
      );
      const data = await res.json();

      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

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

    const reader = new FileReader();
    reader.onloadend = () => {
      setNuevoEvento((prev) => ({
        ...prev,
        imagen: reader.result,
        nombreImagen: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const formatearFecha = (fecha, hora) => {
    if (!fecha || !hora) return "";

    const fechaObj = new Date(`${fecha}T${hora}`);

    return fechaObj.toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }

    const coords = await geocodificarDireccion(nuevoEvento.ubicacion);
    const coordsFinales = coords || { lat: -34.6037, lng: -58.3816 };

    const nuevo = {
      id: siguienteEventoId.current,
      titulo: nuevoEvento.titulo,
      lugar: nuevoEvento.ubicacion,
      fecha: formatearFecha(nuevoEvento.fecha, nuevoEvento.hora),
      genero: normalizarGenero(nuevoEvento.genero),
      coords: [coordsFinales.lat, coordsFinales.lng],
      img: nuevoEvento.imagen || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
      link: nuevoEvento.link || "",
      guardado: false,
      creador: usuario?.email || "Anonimo"
    };

    siguienteEventoId.current += 1;
    setEventos([nuevo, ...eventos]);
    setUltimoEventoDetalle(nuevo);
    setEventoActivo(nuevo.id);
    setMostrarModal(false);
    setMostrarAyuda(false);

    setNuevoEvento({
      titulo: "",
      genero: "",
      ubicacion: "",
      fecha: "",
      hora: "",
      link: "",
      imagen: null,
      nombreImagen: ""
    });
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

      {eventosFiltrados.length === 0 && (
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
              style={{ backgroundImage: `url(${detalleEvento.img})` }}
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

              <div className="ubicacion-row">
                <input
                  type="text"
                  name="ubicacion"
                  placeholder="Ej: Av Corrientes 1234, Buenos Aires"
                  value={nuevoEvento.ubicacion}
                  onChange={handleChange}
                  required
                />

                <button className="btn-help" type="button" onClick={() => setMostrarAyuda(!mostrarAyuda)}>
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M513.5-254.5Q528-269 528-290t-14.5-35.5Q499-340 478-340t-35.5 14.5Q428-311 428-290t14.5 35.5Q457-240 478-240t35.5-14.5ZM442-394h74q0-33 7.5-52t42.5-52q26-26 41-49.5t15-56.5q0-56-41-86t-97-30q-57 0-92.5 30T342-618l66 26q5-18 22.5-39t53.5-21q32 0 48 17.5t16 38.5q0 20-12 37.5T506-526q-44 39-54 59t-10 73Zm38 314q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
                </button>
              </div>

              <input type="date" name="fecha" value={nuevoEvento.fecha} onChange={handleChange} required />
              <input type="time" name="hora" value={nuevoEvento.hora} onChange={handleChange} required />
              <input type="url" name="link" placeholder="URL de compra (opcional)" value={nuevoEvento.link} onChange={handleChange} />

              <div className="evento-modal-botones">
                <button type="submit">Crear</button>
                <button type="button" onClick={() => setMostrarModal(false)}>Cancelar</button>
              </div>

              {mostrarAyuda && (
                <p className="evento-modal-ayuda">
                  Para agregar una ubicacion valida en el primer intento, podes buscar en Google Maps el lugar del evento, copiar la direccion y pegarla en el campo de ubicacion.
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
