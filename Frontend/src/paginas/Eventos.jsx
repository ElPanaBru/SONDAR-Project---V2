import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "leaflet/dist/leaflet.css";
import "./eventos.css";
import L from "leaflet";
import { apiRequest } from "../lib/api";
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
const LOGO_EVENTO_PREDETERMINADO = "/sondar-logo.png";
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
  ...COORDENADAS_INICIALES,
});

const mapearEvento = (evento) => ({
  ...evento,
  img: LOGO_EVENTO_PREDETERMINADO,
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

const formatearDistancia = (distancia) => {
  const kilometros = Number(distancia);
  if (!Number.isFinite(kilometros)) return "";
  if (kilometros < 1) return `${Math.max(1, Math.round(kilometros * 1000))} m`;
  return `${kilometros < 10 ? kilometros.toFixed(1) : Math.round(kilometros)} km`;
};

const formatearTiempoPreview = (segundos) => {
  const total = Number.isFinite(Number(segundos)) ? Math.max(0, Math.floor(Number(segundos))) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

function IconoPanel({ nombre, size = 20 }) {
  const trazos = {
    calendario: <><path d="M7 2v3M17 2v3M3.5 9h17" /><rect x="3.5" y="4.5" width="17" height="16" rx="3" /></>,
    ubicacion: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    guardar: <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />,
    compartir: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></>,
    subir: <path d="m6 14 6-6 6 6M12 8v12" />,
    cerrar: <path d="m6 6 12 12M18 6 6 18" />,
    musica: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    play: <path d="m9 6 9 6-9 6Z" />,
    pausa: <><path d="M9 6v12M15 6v12" /></>,
    izquierda: <path d="m15 5-7 7 7 7" />,
    derecha: <path d="m9 5 7 7-7 7" />,
    anterior: <><path d="M6 5v14" /><path d="m18 6-8 6 8 6Z" /></>,
    siguiente: <><path d="M18 5v14" /><path d="m6 6 8 6-8 6Z" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {trazos[nombre]}
    </svg>
  );
}

export default function Eventos({ usuario }) {
  const { t } = usePreferencias();
  const [searchParams] = useSearchParams();
  const eventoCompartido = searchParams.get("evento");
  const crearEventoParam = searchParams.get("crear");
  const generoUrl = searchParams.get("genero")?.trim().toLowerCase() || "";
  const filtroGeneroUrl = generoUrl && GENEROS_PERMITIDOS_SET.has(generoUrl) ? generoUrl : "todos";
  const generosIniciales = filtroGeneroUrl === "todos" ? GENEROS_PERMITIDOS : [filtroGeneroUrl];
  // Referencias para el mapa principal
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);
  const avisoTimer = useRef(null);
  
  // Referencias para el MINI MAPA del modal (Picker)
  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const miniMarkerRef = useRef(null);
  const audioPreviewRef = useRef(null);

  // Estados de UI y Filtros
  const [eventoActivo, setEventoActivo] = useState(null);
  const [ultimoEventoDetalle, setUltimoEventoDetalle] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [detalleExpandido, setDetalleExpandido] = useState(false);
  const [generosVisibles, setGenerosVisibles] = useState(generosIniciales);
  const [aviso, setAviso] = useState("");
  const [zoomMapa, setZoomMapa] = useState(12);
  const [menuEventoAbierto, setMenuEventoAbierto] = useState(false);
  const [denunciaPendiente, setDenunciaPendiente] = useState(null);
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [reels, setReels] = useState([]);
  const [cargandoReels, setCargandoReels] = useState(true);
  const [reelActivo, setReelActivo] = useState(null);
  const [previewSeleccionadaId, setPreviewSeleccionadaId] = useState(null);
  const [tiempoPreview, setTiempoPreview] = useState(0);
  const [duracionPreview, setDuracionPreview] = useState(0);
  const [posicionUsuario, setPosicionUsuario] = useState(null);
  
  const navigate = useNavigate();


  // Estados de Datos y Carga
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [mostrarBuscadorOrganizador, setMostrarBuscadorOrganizador] = useState(false);

  // Estado del nuevo evento
  const [nuevoEvento, setNuevoEvento] = useState(crearEventoVacio);

  const coordsInicialesRef = useRef(COORDENADAS_INICIALES);
  const subiendoRef = useRef(false);

  const mostrarAviso = useCallback((mensaje) => {
    clearTimeout(avisoTimer.current);
    setAviso(mensaje);
    avisoTimer.current = setTimeout(() => {
      setAviso("");
    }, 2400);
  }, []);

  useEffect(() => () => clearTimeout(avisoTimer.current), []);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let activo = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!activo) return;
        setPosicionUsuario({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 }
    );
    return () => { activo = false; };
  }, []);

  // 1. Carga inicial de eventos desde el Backend
  useEffect(() => {
    let isMounted = true;
    const cargarEventos = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const parametros = new URLSearchParams();
        if (posicionUsuario) {
          parametros.set("lat", String(posicionUsuario.lat));
          parametros.set("lng", String(posicionUsuario.lng));
        }
        const endpoint = `/api/eventos${parametros.size ? `?${parametros.toString()}` : ""}`;
        const res = await apiRequest(endpoint, {
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
  }, [usuario?.id, posicionUsuario]);

  useEffect(() => {
    let activo = true;
    const cargarReels = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const response = await apiRequest("/api/reels", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error("No se pudieron cargar las previews.");
        const data = await response.json();
        if (activo) setReels(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error al cargar previews de Reels:", error);
      } finally {
        if (activo) setCargandoReels(false);
      }
    };
    cargarReels();
    return () => { activo = false; };
  }, [usuario?.id]);

  const eventoSeleccionado = useMemo(
    () => eventos.find((evento) => evento.id === eventoActivo),
    [eventos, eventoActivo]
  );

  const detalleEvento = eventoSeleccionado || ultimoEventoDetalle;

  const reelsDelEvento = useMemo(() => {
    if (!detalleEvento) return [];
    const participantes = new Set([
      detalleEvento.creador_id,
      ...(detalleEvento.organizadores || []).map((organizador) => organizador.id),
    ].filter(Boolean).map(String));
    return reels.filter((reel) => participantes.has(String(reel.creadorId)));
  }, [detalleEvento, reels]);

  const previewSeleccionada = previewSeleccionadaId
    ? reelsDelEvento.find((reel) => reel.id === previewSeleccionadaId) || null
    : null;
  const indicePreviewSeleccionada = previewSeleccionada
    ? reelsDelEvento.findIndex((reel) => reel.id === previewSeleccionada.id)
    : -1;

  useEffect(() => {
    const audio = audioPreviewRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setReelActivo(null);
    setPreviewSeleccionadaId(null);
    setTiempoPreview(0);
    setDuracionPreview(0);
  }, [detalleEvento?.id, detalleExpandido]);

  useEffect(() => {
    setMenuEventoAbierto(false);
  }, [eventoActivo]);

  const eventosFiltrados = useMemo(
    () => eventos.filter((evento) => generosVisibles.includes(normalizarGenero(evento.genero))),
    [eventos, generosVisibles]
  );

  const eventosConCoordenadas = useMemo(
    () => eventosFiltrados.filter(tieneCoordenadasValidas),
    [eventosFiltrados]
  );
  const todosGenerosVisibles = generosVisibles.length === GENEROS_PERMITIDOS.length;

  useEffect(() => {
    if (!detalleEvento) return;
    if (generosVisibles.includes(normalizarGenero(detalleEvento.genero))) return;

    setEventoActivo(null);
    setUltimoEventoDetalle(null);
    setDetalleExpandido(false);
  }, [detalleEvento, generosVisibles]);

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

    const generoDestino = normalizarGenero(eventoDestino.genero);
    setGenerosVisibles((actuales) =>
      actuales.includes(generoDestino)
        ? actuales
        : GENEROS_PERMITIDOS.filter((genero) => [...actuales, generoDestino].includes(genero))
    );
    setUltimoEventoDetalle(eventoDestino);
    setEventoActivo(eventoDestino.id);
    setDetalleExpandido(true);
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
      const imagenEvento = LOGO_EVENTO_PREDETERMINADO;
      const compacto = zoomMapa <= 11;

      const marker = L.marker(posicionFinal, {
        icon: L.divIcon({
          className: "evento-pin-wrapper",
          html: `
            <button class="evento-pin ${activo ? "activo" : ""} ${compacto ? "compacto" : ""}" type="button" aria-label="${escaparHtml(evento.titulo)}" title="${escaparHtml(evento.titulo)}">
              <span class="evento-pin-pulse">
                <img src="${escaparHtml(imagenEvento)}" alt="" onerror="this.onerror=null;this.src='/sondar-logo.png'" />
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
        setDetalleExpandido(false);
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

      const response = await apiRequest(`/api/eventos/${id}/guardar`, {
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

  const seleccionarEvento = useCallback((evento, expandir = false) => {
    setUltimoEventoDetalle(evento);
    setEventoActivo(evento.id);
    setDetalleExpandido(expandir);
    if (tieneCoordenadasValidas(evento) && mapInstance.current) {
      mapInstance.current.flyTo(evento.coords, expandir ? 15 : 16, {
        duration: DURACION_ACERCAMIENTO_MAPA,
        easeLinearity: SUAVIDAD_ACERCAMIENTO_MAPA,
      });
    }
  }, []);

  const navegarEntreEventos = (direccion) => {
    if (eventosFiltrados.length === 0) return;
    const indiceActual = eventosFiltrados.findIndex((evento) => evento.id === detalleEvento?.id);
    const base = indiceActual >= 0 ? indiceActual : 0;
    const siguienteIndice = (base + direccion + eventosFiltrados.length) % eventosFiltrados.length;
    seleccionarEvento(eventosFiltrados[siguienteIndice]);
  };

  const cambiarFiltroGenero = useCallback((genero) => {
    if (genero === "todos") {
      setGenerosVisibles(GENEROS_PERMITIDOS);
      return;
    }

    setGenerosVisibles([genero]);
  }, []);

  useEffect(() => {
    const siguientes = filtroGeneroUrl === "todos" ? GENEROS_PERMITIDOS : [filtroGeneroUrl];
    setGenerosVisibles((actuales) => {
      const mismos =
        actuales.length === siguientes.length &&
        actuales.every((genero) => siguientes.includes(genero));
      return mismos ? actuales : siguientes;
    });
  }, [filtroGeneroUrl]);

  const compartirEvento = async (evento) => {
    const enlace = new URL(window.location.origin);
    enlace.searchParams.set("evento", evento.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: evento.titulo, text: evento.descripcion || evento.titulo, url: enlace.toString() });
      } else {
        await navigator.clipboard.writeText(enlace.toString());
        mostrarAviso("Enlace del evento copiado");
      }
    } catch (error) {
      if (error?.name !== "AbortError") mostrarAviso("No se pudo compartir el evento");
    }
  };

  const alternarPreview = async (reel) => {
    if (!detalleExpandido) return;
    setPreviewSeleccionadaId(reel.id);
    const audio = audioPreviewRef.current;
    if (!audio) return;
    if (!reel?.audio) {
      audio.pause();
      setReelActivo(null);
      return;
    }
    if (reelActivo === reel.id && !audio.paused) {
      audio.pause();
      setReelActivo(null);
      return;
    }
    if (audio.src !== reel.audio) {
      audio.src = reel.audio;
      setTiempoPreview(0);
      setDuracionPreview(0);
    }
    try {
      await audio.play();
      setReelActivo(reel.id);
    } catch {
      mostrarAviso("No se pudo reproducir esta preview");
    }
  };

  const cambiarPreview = (direccion) => {
    if (reelsDelEvento.length < 2 || indicePreviewSeleccionada < 0) return;
    const siguienteIndice = (
      indicePreviewSeleccionada + direccion + reelsDelEvento.length
    ) % reelsDelEvento.length;
    alternarPreview(reelsDelEvento[siguienteIndice]);
  };

  const cambiarTiempoPreview = (event) => {
    const tiempo = Number(event.target.value);
    const audio = audioPreviewRef.current;
    if (!audio || !Number.isFinite(tiempo)) return;
    audio.currentTime = tiempo;
    setTiempoPreview(tiempo);
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
      const response = await apiRequest(`/api/eventos/${evento.id}/denunciar`, {
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

      const response = await apiRequest(`/api/eventos/${evento.id}`, {
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
      setDetalleExpandido(false);
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
      mostrarAviso("Esa persona ya esta agregada como invitada.");
      setNuevoEvento((actual) => ({ ...actual, organizadorBusqueda: "" }));
      return;
    }
    if (nuevoEvento.organizadores.length >= 8) {
      mostrarAviso("Podes agregar hasta 8 invitados o bandas invitadas.");
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


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (subiendoRef.current) return;

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
    subiendoRef.current = true;

    const datosEvento = {
      titulo: nuevoEvento.titulo,
      descripcion: nuevoEvento.descripcion,
      organizadores: JSON.stringify(nuevoEvento.organizadores.map((organizador) => organizador.id)),
      genero: normalizarGenero(nuevoEvento.genero),
      ubicacion: nuevoEvento.lugar,
      fecha: formatearFecha(nuevoEvento.fecha, nuevoEvento.hora),
      precio: nuevoEvento.precio,
      link: nuevoEvento.link,
      latitud: nuevoEvento.lat,
      longitud: nuevoEvento.lng,
    };

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

      const response = await apiRequest("/api/eventos/crear", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: datosEvento
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
      setGenerosVisibles(GENEROS_PERMITIDOS);
      setDetalleExpandido(true);
      
      setMostrarModal(false);

      setNuevoEvento(crearEventoVacio());
      setMostrarBuscadorOrganizador(false);

      mostrarAviso("¡Evento creado con éxito!");

    } catch (error) {
      console.error(error);
      mostrarAviso(error.message || "Hubo un error al guardar el evento.");
    } finally {
      subiendoRef.current = false;
      setSubiendo(false);
    }
  };
  return (
    <div className={`eventos-container ${detalleExpandido ? "detalle-abierto" : ""}`}>
      <div ref={mapRef} className="eventos-mapa" aria-label="Mapa de eventos"></div>

      {loading && (
        <div style={{ position: "absolute", zIndex: 1000, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.8)", padding: "1rem 2rem", borderRadius: "8px", color: "white" }}>
          Cargando mapa y eventos...
        </div>
      )}

      {!loading && eventosFiltrados.length === 0 && (
        <div className="eventos-vacio">
          {t("No hay eventos disponibles")}
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

      <section className={`eventos-sheet ${detalleExpandido ? "expandido" : ""}`} aria-live="polite">
        <button
          className="eventos-sheet-handle"
          type="button"
          aria-label={detalleExpandido ? "Bajar detalle del evento" : "Abrir detalle del evento"}
          aria-expanded={detalleExpandido}
          onClick={() => detalleEvento && setDetalleExpandido((actual) => !actual)}
          disabled={!detalleEvento}
        >
          <span></span>
        </button>

        <div className="eventos-sheet-resumen">
          {detalleEvento ? (
            <>
              <button className="eventos-sheet-flecha" type="button" aria-label="Evento anterior" onClick={() => navegarEntreEventos(-1)} disabled={eventosFiltrados.length < 2}>
                <IconoPanel nombre="izquierda" />
              </button>
              <button className="eventos-sheet-identidad" type="button" onClick={() => setDetalleExpandido(true)}>
                <img src={LOGO_EVENTO_PREDETERMINADO} alt="Logo de SONDAR" onError={(event) => { event.currentTarget.src = "/sondar-icon.png"; }} />
                <span>
                  <strong>{detalleEvento.titulo}</strong>
                  <small>{formatearFechaVisible(detalleEvento.fecha)} · {detalleEvento.lugar || detalleEvento.ubicacion || "Lugar a confirmar"}</small>
                  <em>
                    {detalleEvento.motivo_recomendacion || "Evento en SONDAR"}
                    {formatearDistancia(detalleEvento.distancia_km) ? ` · ${formatearDistancia(detalleEvento.distancia_km)} de vos` : ""}
                  </em>
                </span>
              </button>
              <button className="eventos-sheet-flecha" type="button" aria-label="Evento siguiente" onClick={() => navegarEntreEventos(1)} disabled={eventosFiltrados.length < 2}>
                <IconoPanel nombre="derecha" />
              </button>
              <div className="eventos-sheet-acciones">
                <button className={detalleEvento.guardado ? "activo" : ""} type="button" aria-label={detalleEvento.guardado ? "Quitar guardado" : "Guardar evento"} onClick={() => toggleGuardar(detalleEvento.id)}>
                  <IconoPanel nombre="guardar" />
                </button>
                <button type="button" aria-label="Compartir evento" onClick={() => compartirEvento(detalleEvento)}>
                  <IconoPanel nombre="compartir" />
                </button>
                <button className="eventos-sheet-expandir" type="button" aria-label="Abrir detalle" onClick={() => setDetalleExpandido(true)}>
                  <IconoPanel nombre="subir" />
                </button>
              </div>
            </>
          ) : (
            <div className="eventos-sheet-vacio">
              <span className="eventos-sheet-vacio-icono"><IconoPanel nombre="ubicacion" /></span>
              <span><strong>Explorá el mapa</strong><small>Elegí un evento para ver su información y escuchar a quienes participan.</small></span>
            </div>
          )}
        </div>

        {!detalleExpandido ? (
          <div className="eventos-sheet-tags" aria-label="Filtrar eventos por género">
            <button className={todosGenerosVisibles ? "activo" : ""} type="button" aria-pressed={todosGenerosVisibles} onClick={() => cambiarFiltroGenero("todos")}>Todos</button>
            {GENEROS_PERMITIDOS.map((genero) => (
              <button className={!todosGenerosVisibles && generosVisibles.includes(genero) ? "activo" : ""} type="button" key={genero} aria-pressed={!todosGenerosVisibles && generosVisibles.includes(genero)} onClick={() => cambiarFiltroGenero(genero)}>
                {mostrarGenero(genero)}
              </button>
            ))}
          </div>
        ) : null}

        {detalleExpandido && detalleEvento ? (
          <div className="eventos-sheet-contenido">
            <div className="evento-sheet-info">
              <div className="evento-sheet-titulo">
                <div>
                  <span className="evento-sheet-genero">{mostrarGenero(detalleEvento.genero)}</span>
                  <span className="evento-sheet-eyebrow">EVENTO</span>
                  <h2>{detalleEvento.titulo}</h2>
                </div>
                <div className="evento-sheet-acciones-superiores">
                  <button className={detalleEvento.guardado ? "guardado" : ""} type="button" aria-label={detalleEvento.guardado ? "Quitar guardado" : "Guardar evento"} onClick={() => toggleGuardar(detalleEvento.id)}><IconoPanel nombre="guardar" /></button>
                  <button type="button" aria-label="Compartir evento" onClick={() => compartirEvento(detalleEvento)}><IconoPanel nombre="compartir" /></button>
                  <div className="evento-detalle-menu">
                    <button className="evento-detalle-menu-btn" type="button" aria-label="Opciones del evento" aria-expanded={menuEventoAbierto} onClick={() => setMenuEventoAbierto((actual) => !actual)}>
                      <span></span><span></span><span></span>
                    </button>
                    {menuEventoAbierto ? (
                      <div className="evento-detalle-menu-popover">
                        {usuarioPuedeEliminarEvento(detalleEvento) ? (
                          <button type="button" onClick={() => eliminarEvento(detalleEvento)}>Eliminar</button>
                        ) : (
                          <button type="button" onClick={() => {
                            setMenuEventoAbierto(false);
                            if (!usuario) return mostrarAviso("Tenes que iniciar sesion para denunciar publicaciones.");
                            setDenunciaPendiente(detalleEvento);
                          }}>Denunciar publicación</button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" aria-label="Cerrar detalle" onClick={() => setDetalleExpandido(false)}><IconoPanel nombre="cerrar" /></button>
                </div>
              </div>

              <div className="evento-sheet-meta">
                <span><IconoPanel nombre="ubicacion" size={17} />{detalleEvento.lugar || detalleEvento.ubicacion || "Sin especificar"}</span>
                <span><IconoPanel nombre="calendario" size={17} />{formatearFechaVisible(detalleEvento.fecha)}</span>
              </div>
              {detalleEvento.descripcion ? <p className="evento-sheet-descripcion">{detalleEvento.descripcion}</p> : null}

              <div className="evento-sheet-organizadores">
                <span>Invitados y bandas invitadas</span>
                <button type="button" onClick={() => detalleEvento.creador_id && navigate(`/perfil/${detalleEvento.creador_id}`)}>
                  {detalleEvento.avatar ? <img src={detalleEvento.avatar} alt="" /> : <i>{String(detalleEvento.creador || "A").charAt(0).toUpperCase()}</i>}
                  {detalleEvento.creador || "Anónimo"}
                </button>
                {(detalleEvento.organizadores || []).map((organizador) => (
                  <button type="button" key={organizador.id} onClick={() => navigate(`/perfil/${organizador.id}`)}>
                    {organizador.avatar ? <img src={organizador.avatar} alt="" /> : <i>{String(organizador.nombre || "A").charAt(0).toUpperCase()}</i>}
                    {organizador.nombre || organizador.username}
                  </button>
                ))}
              </div>

              {detalleEvento.link ? (
                <div className="evento-sheet-botones">
                  <a href={detalleEvento.link} target="_blank" rel="noreferrer">{detalleEvento.precio ? `Entradas · $${Number(detalleEvento.precio).toLocaleString("es-AR")}` : "Ver entradas"}</a>
                </div>
              ) : null}
            </div>

            {previewSeleccionada ? (
              <div className="evento-preview-reproductor" aria-live="polite" key={previewSeleccionada.id}>
                <img src={previewSeleccionada.portada || "/sondar-icon.png"} alt={`Portada de ${previewSeleccionada.tema}`} />
                <div className="evento-preview-reproductor-cuerpo">
                  <div className="evento-preview-reproductor-info">
                    <span>{previewSeleccionada.genero || "Reel"}</span>
                    <strong>{previewSeleccionada.tema}</strong>
                    <small>{previewSeleccionada.artista} · {previewSeleccionada.album || "Demo"}</small>
                  </div>
                  <div className="evento-preview-controles" aria-label="Controles de preview">
                    <button type="button" aria-label="Preview anterior" onClick={() => cambiarPreview(-1)} disabled={reelsDelEvento.length < 2}>
                      <IconoPanel nombre="anterior" size={21} />
                    </button>
                    <button className="principal" type="button" aria-label={reelActivo === previewSeleccionada.id ? "Pausar preview" : "Reproducir preview"} onClick={() => alternarPreview(previewSeleccionada)} disabled={!previewSeleccionada.audio}>
                      <IconoPanel nombre={reelActivo === previewSeleccionada.id ? "pausa" : "play"} size={23} />
                    </button>
                    <button type="button" aria-label="Preview siguiente" onClick={() => cambiarPreview(1)} disabled={reelsDelEvento.length < 2}>
                      <IconoPanel nombre="siguiente" size={21} />
                    </button>
                  </div>
                  <div className="evento-preview-progreso">
                    <time>{formatearTiempoPreview(tiempoPreview)}</time>
                    <input
                      type="range"
                      min="0"
                      max={duracionPreview || 1}
                      step="0.1"
                      value={Math.min(tiempoPreview, duracionPreview || 1)}
                      onChange={cambiarTiempoPreview}
                      aria-label={`Progreso de ${previewSeleccionada.tema}`}
                      style={{ "--preview-avance": `${duracionPreview ? (tiempoPreview / duracionPreview) * 100 : 0}%` }}
                    />
                    <time>{formatearTiempoPreview(duracionPreview)}</time>
                  </div>
                </div>
              </div>
            ) : null}

            <section className="evento-previews" aria-labelledby="evento-previews-titulo">
              <div className="evento-previews-encabezado">
                <div><span>PREVIEWS</span><h3 id="evento-previews-titulo">Así suena este evento</h3></div>
                <small>Contenido publicado en Reels por sus participantes</small>
              </div>

              {cargandoReels ? <p className="evento-previews-estado">Cargando previews...</p> : null}
              {!cargandoReels && reelsDelEvento.length === 0 ? <p className="evento-previews-estado">Todavía no hay Reels publicados por quienes participan.</p> : null}
              {reelsDelEvento.length > 0 ? (
                <div className="evento-preview-lista">
                  {reelsDelEvento.map((reel) => (
                    <button className={reel.id === previewSeleccionada?.id ? "seleccionado" : ""} type="button" key={reel.id} onClick={() => alternarPreview(reel)}>
                      <span className="evento-preview-icono"><IconoPanel nombre={reel.id === reelActivo ? "pausa" : "musica"} size={18} /></span>
                      <span><strong>{reel.tema}</strong><small>{reel.artista} · {reel.album || reel.genero || "Reel"}</small></span>
                      <time>{reel.duracion || "0:30"}</time>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
        <audio
          ref={audioPreviewRef}
          onTimeUpdate={(event) => setTiempoPreview(event.currentTarget.currentTime || 0)}
          onLoadedMetadata={(event) => setDuracionPreview(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onDurationChange={(event) => setDuracionPreview(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onEnded={() => setReelActivo(null)}
        />
      </section>

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

              <section className="evento-organizadores-selector" aria-label="Invitados y bandas invitadas del evento">
                <div className="evento-organizadores-encabezado">
                  <span>Invitados o bandas invitadas</span>
                  <small>Vos sos quien crea el evento</small>
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
                  Agregar invitado
                </button>

                {mostrarBuscadorOrganizador ? (
                  <CampoMenciones
                    className="evento-organizador-buscador"
                    multiline={false}
                    type="text"
                    value={nuevoEvento.organizadorBusqueda}
                    onChange={(organizadorBusqueda) => setNuevoEvento((actual) => ({ ...actual, organizadorBusqueda }))}
                    onMentionSelect={agregarCoorganizador}
                    placeholder="Escribi @ y busca a la persona o banda"
                    aria-label="Buscar invitado o banda invitada"
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
