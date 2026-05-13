import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./eventos.css";
import L from "leaflet";

export default function Eventos({ usuario }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarAyuda, setMostrarAyuda] = useState(false);
  const [filtroGenero, setFiltroGenero] = useState("todos");

  const generosPermitidos = [
    "pop", "rock", "edm", "jazz", "blues",
    "cumbia", "trap", "metal", "folklore", "otros"
  ];

  const [eventos, setEventos] = useState([
    {
      id: 1,
      titulo: "Evento 1",
      lugar: "Buenos Aires",
      fecha: "29/04/2026 22:00",
      genero: "general",
      coords: [-34.6037, -58.3816],
      img: "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2",
      link: "https://www.ticketek.com.ar",
      guardado: false,
      creador: "demo@gmail.com"
    },
    {
      id: 2,
      titulo: "Evento 2",
      lugar: "Palermo",
      fecha: "30/04/2026 21:00",
      genero: "techno",
      coords: [-34.5883, -58.43],
      img: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
      link: "",
      guardado: false,
      creador: "demo@gmail.com"
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

  useEffect(() => {
    if (!eventoSeleccionado || !mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current).setView(eventoSeleccionado.coords, 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    mapInstance.current = map;

    L.marker(eventoSeleccionado.coords)
      .addTo(map)
      .bindPopup(`<b>${eventoSeleccionado.titulo}</b><br>${eventoSeleccionado.lugar}`)
      .openPopup();

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
      map.flyTo(eventoSeleccionado.coords, 16, { duration: 0.8 });
    }, 220);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapInstance.current = null;
    };
  }, [eventoSeleccionado]);

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

  const normalizarGenero = (genero) => {
    const gen = genero.toLowerCase();
    return generosPermitidos.includes(gen) ? gen : "otros";
  };

  const toggleGuardar = (id) => {
    if (!usuario) {
      alert("Debes estar logeado para guardar");
      return;
    }

    setEventos(eventos.map((evento) =>
      evento.id === id ? { ...evento, guardado: !evento.guardado } : evento
    ));
  };

  const irAlEvento = (evento) => {
    setEventoActivo((activo) => activo === evento.id ? null : evento.id);
  };

  const handleCrearEvento = () => {
    setMostrarModal(true);
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

    const coords = await geocodificarDireccion(nuevoEvento.ubicacion);
    const coordsFinales = coords || { lat: -34.6037, lng: -58.3816 };

    const nuevo = {
      id: Date.now(),
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

    setEventos([nuevo, ...eventos]);
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

  const eventosFiltrados = eventos.filter((evento) =>
    filtroGenero === "todos" ? true : normalizarGenero(evento.genero) === filtroGenero
  );

  return (
    <div className="eventos-container">
      <div className="eventos-panel">
        <div className="eventos-header">
          <div>
            <span className="eventos-eyebrow">Sondar</span>
            <h2>Eventos</h2>
          </div>

          <div className="eventos-acciones">
            <label>
              <span>Filtrar eventos</span>
              <select
                className="eventos-filtro"
                value={filtroGenero}
                onChange={(e) => setFiltroGenero(e.target.value)}
              >
                <option value="todos">Todos</option>
                {generosPermitidos.map((genero) => (
                  <option key={genero} value={genero}>{genero}</option>
                ))}
              </select>
            </label>
            <button className="btn-crear-evento" onClick={handleCrearEvento}>
              Crear Evento
            </button>
          </div>
        </div>

        <div className="eventos-lista">
          {eventosFiltrados.map((evento) => (
            <div key={evento.id} className="evento-bloque">
              <article
                className={`evento-card ${eventoActivo === evento.id ? "activo" : ""}`}
                onClick={() => irAlEvento(evento)}
              >
                <div
                  className="evento-imagen"
                  style={{ backgroundImage: `url(${evento.img})` }}
                >
                  <span className="evento-genero">
                    {evento.genero || "general"}
                  </span>

                  <button
                    className="btn-like"
                    aria-label={evento.guardado ? "Quitar guardado" : "Guardar evento"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGuardar(evento.id);
                    }}
                  >
                    {!evento.guardado ? (
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000">
                        <path d="M680-80v-120H560v-80h120v-120h80v120h120v80H760v120h-80Zm-480-80q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h40v-80h80v80h240v-80h80v80h40q33 0 56.5 23.5T760-720v244q-20-3-40-3t-40 3v-84H200v320h280q0 20 3 40t11 40H200Zm0-480h480v-80H200v80Z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000">
                        <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v255l-80 80v-175H200v400h248l80 80H200Zm462 20L520-202l56-56 85 85 170-170 56 57L662-60Z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="evento-info">
                  <div className="evento-datos">
                    <h4>{evento.titulo}</h4>
                    <p>{evento.lugar}</p>
                    <p>{evento.fecha}</p>
                    <p className="evento-creador">{evento.creador || "Anonimo"}</p>
                  </div>

                  {evento.link && (
                    <a
                      href={evento.link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-comprar"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Comprar
                    </a>
                  )}
                </div>
              </article>

              {eventoActivo === evento.id && (
                <section className="mapa-desplegable" aria-label={`Mapa de ${evento.titulo}`}>
                  <div className="mapa-desplegable-header">
                    <div>
                      <span>Ubicacion</span>
                      <strong>{evento.lugar}</strong>
                    </div>
                    <button type="button" onClick={() => setEventoActivo(null)}>
                      Cerrar
                    </button>
                  </div>
                  <div ref={mapRef} id="map"></div>
                </section>
              )}
            </div>
          ))}
        </div>
      </div>

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
                {generosPermitidos.map((genero) => (
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