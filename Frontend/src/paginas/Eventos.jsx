import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "leaflet/dist/leaflet.css";
import "./eventos.css";
import L from "leaflet";
import { apiUrl } from "../lib/api";
import { avisarDenunciaASoporte } from "../lib/reportarContenido";
import { supabase } from "../lib/supabaseClient";
import CampoMenciones from "../componentes/CampoMenciones";
import DenunciaModal, { etiquetaMotivoDenuncia } from "../componentes/DenunciaModal";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "../componentes/eventoOrganizadorPopover.css";


const GENEROS_PERMITIDOS = [
  "pop", "rock", "edm", "jazz", "blues",
  "cumbia", "trap", "metal", "folklore", "otros"
];
const GENEROS_PERMITIDOS_SET = new Set(GENEROS_PERMITIDOS);

const DURACION_ACERCAMIENTO_MAPA = 0.8;
const SUAVIDAD_ACERCAMIENTO_MAPA = 0.25;
const DOS_MESES_EN_MS = 1000 * 60 * 60 * 24 * 30 * 2;
const COORDENADAS_INICIALES = { lat: -34.6037, lng: -58.3816 };
const FORMATEADOR_FECHA_VISIBLE = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const crearEventoVacio = () => ({
  titulo: "",
  descripcion: "",
  organizadorBusqueda: "",
  organizadores: [],
  genero: "",
  lugar: "",
  fecha: "",
  hora: "",
  precio: "",
  link: "",
  imagen: null,
  nombreImagen: "",
  ...COORDENADAS_INICIALES,
});

const mapearEvento = (evento) => ({
  ...evento,
  img: evento.img || evento.img_url,
  coords: [parseFloat(evento.latitud), parseFloat(evento.longitud)],
});

const tieneCoordenadasValidas = (evento) =>
  evento.coords && !isNaN(evento.coords[0]) && !isNaN(evento.coords[1]);

const normalizarGenero = (genero) => {
  const gen = genero?.trim().toLowerCase() || "otros";
  return GENEROS_PERMITIDOS_SET.has(gen) ? gen : "otros";
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

const formatearFecha = (fecha, hora) => {
  if (!fecha || !hora) return "";
  return new Date(`${fecha}T${hora}`).toISOString();
};

const formatearFechaVisible = (fecha) => {
  if (!fecha) return "Sin fecha";

  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return fecha;

  return FORMATEADOR_FECHA_VISIBLE.format(valor);
};

export default function Eventos({ usuario }) {
  const { t } = usePreferencias();
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
  const [denunciaPendiente, setDenunciaPendiente] = useState(null);
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [hoverOrganizador, setHoverOrganizador] = useState(null);
  
  const navigate = useNavigate();


  // Estados de Datos y Carga
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [mostrarBuscadorOrganizador, setMostrarBuscadorOrganizador] = useState(false);

  // Estado del nuevo evento
  const [nuevoEvento, setNuevoEvento] = useState(crearEventoVacio);

  const coordsInicialesRef = useRef(COORDENADAS_INICIALES);

  const mostrarAviso = useCallback((mensaje) => {
    clearTimeout(avisoTimer.current);
    setAviso(mensaje);
    avisoTimer.current = setTimeout(() => {
      setAviso("");
    }, 2400);
  }, []);

  useEffect(() => () => clearTimeout(avisoTimer.current), []);

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
          const eventosMapeados = data.map(mapearEvento);
          
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

  const eventosConCoordenadas = useMemo(
    () => eventosFiltrados.filter(tieneCoordenadasValidas),
    [eventosFiltrados]
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
      const timer = setTimeout(() => {
        mapInstance.current.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
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
  }, [crearEventoParam, mostrarAviso, usuario]);

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
    const resizeTimer = setTimeout(() => {
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
      clearTimeout(resizeTimer);
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
    const distanciaAgrupacion = zoomMapa >= 15 ? 34 : zoomMapa >= 12 ? 58 : 82;
    const grupos = [];

    eventosConCoordenadas.forEach((evento) => {
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
      const imagenEvento = evento.img || evento.img_url || "/sondar-icon.png";
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
  }, [eventosConCoordenadas, eventoActivo, zoomMapa]);

  // 5. Encuadre automático del mapa principal
  useEffect(() => {
    if (!mapInstance.current || eventosConCoordenadas.length === 0) return;

    const coordsValidas = eventosConCoordenadas.map((evento) => evento.coords);

    if (coordsValidas.length === 0) return;

    const bounds = L.latLngBounds(coordsValidas);
   acercarMapaABounds(mapInstance.current, bounds, 13);
  }, [eventosConCoordenadas]);

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

  const denunciarEvento = async (evento, { motivo, detalle }) => {
    if (!evento?.id || usuarioPuedeEliminarEvento(evento)) return;
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para denunciar publicaciones.");
      return;
    }
    setEnviandoDenuncia(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion expiro. Volve a iniciar sesion.");
      const response = await fetch(apiUrl(`/api/eventos/${evento.id}/denunciar`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: motivo, detail: detalle }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo denunciar el evento.");
      setMenuEventoAbierto(false);
      setDenunciaPendiente(null);
      if (body.nuevaDenuncia === false) {
        mostrarAviso("Ya habias denunciado este evento.");
        return;
      }
      try {
        await avisarDenunciaASoporte({
          usuario,
          tipo: "evento",
          contenidoId: evento.id,
          titulo: evento.titulo,
          autor: evento.creador,
          motivo: etiquetaMotivoDenuncia(motivo),
          detalle,
        });
        mostrarAviso("Evento denunciado. Soporte fue notificado.");
      } catch (emailError) {
        console.error("Email de denuncia:", emailError);
        mostrarAviso("La denuncia fue registrada, pero no se pudo enviar el email a soporte.");
      }
    } catch (error) {
      mostrarAviso(error.message || "No se pudo denunciar el evento.");
    } finally {
      setEnviandoDenuncia(false);
    }
  };

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

  const handleCrearEvento = useCallback(() => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }
    setMostrarModal(true);
  }, [mostrarAviso, usuario]);

  useEffect(() => {
    const abrirDesdeSidebar = () => handleCrearEvento();
    window.addEventListener("sondar:crear-evento", abrirDesdeSidebar);
    return () => window.removeEventListener("sondar:crear-evento", abrirDesdeSidebar);
  }, [handleCrearEvento]);

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
    const { name, value } = e.target;
    setNuevoEvento((actual) => ({ ...actual, [name]: value }));
  };

  const agregarCoorganizador = (persona) => {
    if (!persona?.id || persona.id === usuario?.id) {
      mostrarAviso("Vos ya sos el creador principal del evento.");
      setNuevoEvento((actual) => ({ ...actual, organizadorBusqueda: "" }));
      return;
    }
    if (nuevoEvento.organizadores.some((organizador) => organizador.id === persona.id)) {
      mostrarAviso("Esa persona ya esta agregada como organizadora.");
      setNuevoEvento((actual) => ({ ...actual, organizadorBusqueda: "" }));
      return;
    }
    if (nuevoEvento.organizadores.length >= 8) {
      mostrarAviso("Podes agregar hasta 8 coorganizadores.");
      setNuevoEvento((actual) => ({ ...actual, organizadorBusqueda: "" }));
      return;
    }
    setNuevoEvento((actual) => ({
      ...actual,
      organizadorBusqueda: "",
      organizadores: [...actual.organizadores, persona],
    }));
  };

  const quitarCoorganizador = (id) => {
    setNuevoEvento((actual) => ({
      ...actual,
      organizadores: actual.organizadores.filter((organizador) => organizador.id !== id),
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones de fecha: no permitir en el pasado ni demasiado futuro.
    // - Pasado: fecha+hora debe ser >= ahora
    // - Futuro: no más de 2 meses desde hoy
    const ahora = new Date();
    const fechaInput = nuevoEvento.fecha;
    const horaInput = nuevoEvento.hora;

    if (!fechaInput || !horaInput) {
      mostrarAviso("Elegí una fecha y hora válidas.");
      setSubiendo(false);
      return;
    }

    const fechaEvento = new Date(`${fechaInput}T${horaInput}`);
    const maxFecha = new Date(ahora.getTime() + DOS_MESES_EN_MS);


    if (Number.isNaN(fechaEvento.getTime())) {
      mostrarAviso("La fecha del evento no es válida.");
      setSubiendo(false);
      return;
    }

    if (fechaEvento.getTime() < ahora.getTime()) {
      mostrarAviso("No se puede crear un evento en una fecha que ya pasó.");
      setSubiendo(false);
      return;
    }

    if (fechaEvento.getTime() > maxFecha.getTime()) {
      mostrarAviso("No se puede crear un evento en una fecha dentro de más de dos meses.");
      setSubiendo(false);
      return;
    }


    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para crear eventos");
      return;
    }

    setSubiendo(true);

    const formData = new FormData();
    formData.append("titulo", nuevoEvento.titulo);
    formData.append("descripcion", nuevoEvento.descripcion);
    formData.append(
      "organizadores",
      JSON.stringify(nuevoEvento.organizadores.map((organizador) => organizador.id))
    );
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
      
      const eventoParaMapa = mapearEvento(eventoGuardado);

      setEventos((actuales) => [eventoParaMapa, ...actuales]);
      setUltimoEventoDetalle(eventoParaMapa);
      setEventoActivo(eventoParaMapa.id);
      
      setMostrarModal(false);
      if (imagenEventoInputRef.current) imagenEventoInputRef.current.value = "";

      setNuevoEvento(crearEventoVacio());
      setMostrarBuscadorOrganizador(false);

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
            <h2>{t("Eventos cerca tuyo")}</h2>
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
          {t("No hay eventos de este género")}
        </div>
      )}

      {aviso && (
        <div
          className="eventos-toast"
          role="status"
          style={{ zIndex: 200000 }}
        >
          {aviso}
        </div>
      )}

      <aside className={`evento-detalle ${eventoSeleccionado ? "abierto" : ""}`} aria-live="polite">
        {detalleEvento && (
          <>
            <button className="evento-detalle-cerrar" type="button" onClick={() => setEventoActivo(null)}>
              Cerrar
            </button>

            {detalleEvento ? (
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
                    {usuarioPuedeEliminarEvento(detalleEvento) ? (
                      <button type="button" onClick={() => eliminarEvento(detalleEvento)}>
                        Eliminar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuEventoAbierto(false);
                          if (!usuario) {
                            mostrarAviso("Tenes que iniciar sesion para denunciar publicaciones.");
                            return;
                          }
                          setDenunciaPendiente(detalleEvento);
                        }}
                      >
                        Denunciar publicacion
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              className="evento-detalle-imagen"
              style={{ backgroundImage: `url(${detalleEvento.img || detalleEvento.img_url || "/sondar-icon.png"})` }}
            >
              <span>{mostrarGenero(detalleEvento.genero)}</span>
            </div>

            <div className="evento-detalle-info">
              <span className="eventos-eyebrow">Evento seleccionado</span>
              <h3>{detalleEvento.titulo}</h3>
              {detalleEvento.descripcion ? (
                <p className="evento-detalle-descripcion">
                  {detalleEvento.descripcion}
                </p>
              ) : null}
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
                  <dd className="evento-organiza-dd" onMouseLeave={() => setHoverOrganizador(null)}>
                    <span className="evento-organiza-identidad">
                      <button
                        type="button"
                        className="evento-organiza-trigger"
                        onMouseEnter={() => setHoverOrganizador(detalleEvento)}
                        onMouseLeave={() => setHoverOrganizador(null)}
                        onFocus={() => setHoverOrganizador(detalleEvento)}
                        onBlur={() => setHoverOrganizador(null)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (detalleEvento?.creador_id) {
                            navigate(`/perfil/${detalleEvento.creador_id}`);
                          }
                        }}
                        aria-label={`Ver perfil de ${detalleEvento.creador || "Anonimo"}`}
                      >
                        {detalleEvento.creador || "Anonimo"}
                      </button>
                    </span>

                    {hoverOrganizador?.id === detalleEvento?.id ? (
                      <div className="evento-organiza-popover" role="dialog" aria-label="Perfil del organizador">
                        <div className="evento-organiza-popover-inner">
                          <div className="evento-organiza-popover-header">
                            <div className="evento-organiza-avatar">
                              {hoverOrganizador?.avatar ? (
                                <img src={hoverOrganizador.avatar} alt="" />
                              ) : (
                                <span>{String(hoverOrganizador?.creador || "A").charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="evento-organiza-names">
                              <strong>{hoverOrganizador?.creador || "Anonimo"}</strong>
                              <span className="evento-organiza-handle">Perfil</span>





                            </div>
                          </div>


                        </div>
                      </div>
                    ) : null}
                    {Array.isArray(detalleEvento.organizadores) && detalleEvento.organizadores.length > 0 ? (
                      <div className="evento-coorganizadores-lista" aria-label="Coorganizadores del evento">
                        {detalleEvento.organizadores.map((organizador) => (
                          <button
                            className="evento-coorganizador-chip"
                            type="button"
                            key={organizador.id}
                            onClick={() => navigate(`/perfil/${organizador.id}`)}
                            aria-label={`Ver perfil de ${organizador.nombre || organizador.username}`}
                          >
                            <span className="evento-coorganizador-avatar">
                              {organizador.avatar ? (
                                <img src={organizador.avatar} alt="" />
                              ) : (
                                String(organizador.nombre || organizador.username || "O").charAt(0).toUpperCase()
                              )}
                            </span>
                            <span>{organizador.nombre || organizador.username}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <small className="evento-organizador-principal">Creador principal</small>
                    )}
                  </dd>
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

      <DenunciaModal
        abierto={Boolean(denunciaPendiente)}
        titulo={denunciaPendiente?.titulo}
        enviando={enviandoDenuncia}
        onClose={() => setDenunciaPendiente(null)}
        onConfirm={(datos) => denunciarEvento(denunciaPendiente, datos)}
      />

      {mostrarModal && (
        <div className="evento-modal-overlay">
          <section className="evento-modal" role="dialog" aria-modal="true" aria-labelledby="crear-evento-titulo" onMouseDown={(event) => event.stopPropagation()}>
            <header className="evento-modal-header">
              <div>
                <span>EVENTOS</span>
                <h2 id="crear-evento-titulo">{t("Crear nuevo evento")}</h2>
              </div>
              <button className="evento-modal-volver" type="button" onClick={() => setMostrarModal(false)} disabled={subiendo} aria-label="Cerrar creador de evento">
                <svg aria-hidden="true" viewBox="0 -960 960 960" fill="currentColor">
                  <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                </svg>
              </button>
            </header>

            <form id="crear-evento-form" className="evento-modal-form" onSubmit={handleSubmit}>
              <input type="text" name="titulo" placeholder="Nombre del evento" value={nuevoEvento.titulo} onChange={handleChange} required />

              <textarea
                className="evento-descripcion"
                value={nuevoEvento.descripcion}
                onChange={(event) => setNuevoEvento((actual) => ({ ...actual, descripcion: event.target.value }))}
                maxLength={1000}
                rows={3}
                placeholder="Descripcion del evento (opcional)"
                aria-label="Descripcion del evento"
              />

              <section className="evento-organizadores-selector" aria-label="Organizadores del evento">
                <div className="evento-organizadores-encabezado">
                  <span>Organizadores</span>
                  <small>Vos sos el creador principal</small>
                </div>

                {nuevoEvento.organizadores.length > 0 ? (
                  <div className="evento-organizadores-elegidos">
                    {nuevoEvento.organizadores.map((organizador) => (
                      <span className="evento-organizador-elegido" key={organizador.id}>
                        {organizador.nombre || organizador.username}
                        <button
                          type="button"
                          onClick={() => quitarCoorganizador(organizador.id)}
                          aria-label={`Quitar a ${organizador.nombre || organizador.username}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}

                <button
                  className="evento-agregar-organizador"
                  type="button"
                  onClick={() => setMostrarBuscadorOrganizador((actual) => !actual)}
                  aria-expanded={mostrarBuscadorOrganizador}
                >
                  <span aria-hidden="true">+</span>
                  Agregar organizador
                </button>

                {mostrarBuscadorOrganizador ? (
                  <CampoMenciones
                    className="evento-organizador-buscador"
                    multiline={false}
                    type="text"
                    value={nuevoEvento.organizadorBusqueda}
                    onChange={(organizadorBusqueda) => setNuevoEvento((actual) => ({ ...actual, organizadorBusqueda }))}
                    onMentionSelect={agregarCoorganizador}
                    placeholder="Escribi @ y busca a la persona"
                    aria-label="Buscar coorganizador"
                    autoFocus
                  />
                ) : null}
              </section>

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
