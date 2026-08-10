import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { avisarDenunciaASoporte } from "../lib/reportarContenido";
import { supabase } from "../lib/supabaseClient";
import CampoMenciones from "../componentes/CampoMenciones";
import DenunciaModal, { etiquetaMotivoDenuncia } from "../componentes/DenunciaModal";
import TextoConMenciones from "../componentes/TextoConMenciones";
import "./comunidad.css";

const filtros = [
  { id: "destacado", label: "Mas relevantes" },
  { id: "reciente", label: "Mas recientes" },
  { id: "popular", label: "Mas populares" },
  { id: "preguntas", label: "Solo preguntas" },
];

const reglasForo = [
  "Publica musica, eventos, preguntas o recomendaciones vinculadas al genero.",
  "Respeta a artistas y oyentes. Critica ideas, no personas.",
  "Evita spam repetido y agrega contexto cuando compartas enlaces o lanzamientos.",
];

const recursosForo = [
  { id: "eventos", label: "Eventos del genero" },
  { id: "reels", label: "Reels del genero" },
];

const comunidadesPorGenero = [
  {
    id: "pop",
    nombre: "@pop",
    titulo: "Pop",
    genero: "pop",
    descripcion: "Charlas, lanzamientos, preguntas y recomendaciones para la escena pop de SONDAR.",
    categoria: "pop",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "rock",
    nombre: "@rock",
    titulo: "Rock",
    genero: "rock",
    descripcion: "Guitarras, fechas, bandas nuevas, demos y conversaciones de la comunidad rock.",
    categoria: "rock",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "edm",
    nombre: "@edm",
    titulo: "EDM",
    genero: "edm",
    descripcion: "Sets, drops, produccion, festivales y novedades de la comunidad EDM.",
    categoria: "edm",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1571266028243-d220c9c3b8ef?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "jazz",
    nombre: "@jazz",
    titulo: "Jazz",
    genero: "jazz",
    descripcion: "Improvisacion, standards, jams, discos y encuentros para oyentes y musicos de jazz.",
    categoria: "jazz",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "blues",
    nombre: "@blues",
    titulo: "Blues",
    genero: "blues",
    descripcion: "Riffs, armonicas, zapadas, fechas y recomendaciones para quienes siguen el blues.",
    categoria: "blues",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "cumbia",
    nombre: "@cumbia",
    titulo: "Cumbia",
    genero: "cumbia",
    descripcion: "Bandas, bailes, estrenos, eventos y charla abierta para la comunidad cumbiera.",
    categoria: "cumbia",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "trap",
    nombre: "@trap",
    titulo: "Trap",
    genero: "trap",
    descripcion: "Beats, barras, productores, lanzamientos y debates de la escena trap.",
    categoria: "trap",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "metal",
    nombre: "@metal",
    titulo: "Metal",
    genero: "metal",
    descripcion: "Riffs pesados, fechas, discos, bandas emergentes y comunidad metalera.",
    categoria: "metal",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1508252592163-5d3c3c5599ab?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "folklore",
    nombre: "@folklore",
    titulo: "Folklore",
    genero: "folklore",
    descripcion: "Penas, canciones, instrumentos, festivales y relatos de la escena folklorica.",
    categoria: "folklore",
    miembros: 0,
    publicaciones: 0,
    actividad: "Sin publicaciones todavia",
    portada: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1400&q=80",
  },
];

const crearHeadersJson = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const mostrarGenero = (genero) => {
  if (!genero) return "";
  return genero === "edm" ? "EDM" : genero.charAt(0).toUpperCase() + genero.slice(1);
};

const normalizarGenero = (genero) => genero?.trim().toLowerCase() || "";

const formatearFechaCorta = (fecha) => {
  if (!fecha) return "Sin fecha";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return fecha;
  return valor.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
};

const normalizarComentario = (comentario) => ({
  ...comentario,
  votos: Number(comentario.votos ?? comentario.likes ?? 0),
  likes: Number(comentario.likes ?? comentario.votos ?? 0),
  liked: Boolean(comentario.liked),
  respuestas: (comentario.respuestas || []).map(normalizarComentario),
});

const normalizarHilo = (hilo) => ({
  ...hilo,
  votos: Number(hilo.votos ?? hilo.likes ?? 0),
  likes: Number(hilo.likes ?? hilo.votos ?? 0),
  comentarios: (hilo.comentarios || []).map(normalizarComentario),
});

const contarComentarios = (comentarios = []) => comentarios.reduce(
  (total, comentario) => total + 1 + contarComentarios(comentario.respuestas),
  0
);

const agregarComentario = (comentarios, parentId, nuevoComentario) => {
  if (!parentId) return [...comentarios, nuevoComentario];
  return comentarios.map((comentario) => {
    if (String(comentario.id) === String(parentId)) {
      return { ...comentario, respuestas: [...comentario.respuestas, nuevoComentario] };
    }
    return {
      ...comentario,
      respuestas: agregarComentario(comentario.respuestas, parentId, nuevoComentario),
    };
  });
};

const actualizarComentario = (comentarios, comentarioId, actualizar) => comentarios.map((comentario) => {
  if (String(comentario.id) === String(comentarioId)) return actualizar(comentario);
  return {
    ...comentario,
    respuestas: actualizarComentario(comentario.respuestas, comentarioId, actualizar),
  };
});

export default function Comunidad({ usuario }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const avisoTimer = useRef(null);
  const publicandoRef = useRef(false);
  const comentariosEnviandoRef = useRef(new Set());
  const likesComentariosEnviandoRef = useRef(new Set());
  const filtroRef = useRef(null);
  const audioAsociadoRef = useRef(null);
  const busqueda = searchParams.get("comunidad")?.toLowerCase() || "";
  const publicacionCompartida = searchParams.get("publicacion");
  const comentarioCompartido = searchParams.get("comentario");
  const [comunidades, setComunidades] = useState(comunidadesPorGenero);
  const [comunidadActivaId, setComunidadActivaId] = useState("pop");
  const [filtroActivo, setFiltroActivo] = useState("destacado");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [hilos, setHilos] = useState([]);
  const [cargandoHilos, setCargandoHilos] = useState(true);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [respuestaActiva, setRespuestaActiva] = useState(null);
  const [aviso, setAviso] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [comentariosEnviando, setComentariosEnviando] = useState(new Set());
  const [likesComentariosEnviando, setLikesComentariosEnviando] = useState(new Set());
  const [denunciaPendiente, setDenunciaPendiente] = useState(null);
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [actualizandoMembresia, setActualizandoMembresia] = useState(false);
  const [eventosAsociables, setEventosAsociables] = useState([]);
  const [reelsAsociables, setReelsAsociables] = useState([]);
  const [reelAsociadoActivo, setReelAsociadoActivo] = useState(null);
  const [nuevoHilo, setNuevoHilo] = useState({
    titulo: "",
    texto: "",
    tipo: "reciente",
    etiqueta: "",
    eventoAsociadoId: "",
    reelAsociadoId: "",
  });

  const comunidadActiva = useMemo(
    () => comunidades.find((comunidad) => comunidad.id === comunidadActivaId) || comunidades[0],
    [comunidadActivaId, comunidades]
  );

  const filtroSeleccionado = useMemo(
    () => filtros.find((filtro) => filtro.id === filtroActivo) || filtros[0],
    [filtroActivo]
  );

  const eventosDelGenero = useMemo(
    () =>
      eventosAsociables.filter(
        (evento) => normalizarGenero(evento.genero) === normalizarGenero(comunidadActiva?.genero)
      ),
    [comunidadActiva?.genero, eventosAsociables]
  );

  const reelsDelGenero = useMemo(
    () =>
      reelsAsociables.filter(
        (reel) => normalizarGenero(reel.genero || reel.tag || reel.etiqueta) === normalizarGenero(comunidadActiva?.genero)
      ),
    [comunidadActiva?.genero, reelsAsociables]
  );

  const eventoAsociadoSeleccionado = useMemo(
    () => eventosAsociables.find((evento) => String(evento.id) === String(nuevoHilo.eventoAsociadoId)) || null,
    [eventosAsociables, nuevoHilo.eventoAsociadoId]
  );

  const reelAsociadoSeleccionado = useMemo(
    () => reelsAsociables.find((reel) => String(reel.id) === String(nuevoHilo.reelAsociadoId)) || null,
    [nuevoHilo.reelAsociadoId, reelsAsociables]
  );

  useEffect(() => {
    return () => {
      clearTimeout(avisoTimer.current);
    };
  }, []);

  useEffect(() => {
    const cerrarFiltros = (event) => {
      if (!filtroRef.current?.contains(event.target)) setMostrarFiltros(false);
    };

    const cerrarConEscape = (event) => {
      if (event.key === "Escape") setMostrarFiltros(false);
    };

    document.addEventListener("pointerdown", cerrarFiltros);
    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("pointerdown", cerrarFiltros);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargarComunidades() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const response = await apiRequest("/api/comunidades", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error("No se pudieron cargar las comunidades.");

        const dataComunidades = await response.json();
        if (!cancelado && dataComunidades.length > 0) {
          setComunidades(dataComunidades);
          setComunidadActivaId((actual) =>
            dataComunidades.some((comunidad) => comunidad.id === actual)
              ? actual
              : dataComunidades[0].id
          );
        }
      } catch (error) {
        if (!cancelado) {
          mostrarAviso(error.message || "Usando comunidades locales por ahora.");
        }
      }
    }

    cargarComunidades();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargarAsociables() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const [eventosResponse, reelsResponse] = await Promise.all([
          apiRequest("/api/eventos", { headers }),
          apiRequest("/api/reels", { headers }),
        ]);

        if (!cancelado && eventosResponse.ok) {
          const dataEventos = await eventosResponse.json();
          setEventosAsociables(Array.isArray(dataEventos) ? dataEventos : []);
        }

        if (!cancelado && reelsResponse.ok) {
          const dataReels = await reelsResponse.json();
          setReelsAsociables(
            Array.isArray(dataReels)
              ? dataReels.map((reel) => ({
                  ...reel,
                  id: String(reel.id).startsWith("db-") ? reel.id : `db-${reel.id}`,
                  backendId: reel.backendId || reel.id,
                }))
              : []
          );
        }
      } catch (error) {
        console.error("No se pudieron cargar asociaciones para comunidad:", error);
      }
    }

    cargarAsociables();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    const comunidadBuscada = comunidades.find((comunidad) => {
      const valores = [comunidad.id, comunidad.nombre, comunidad.titulo, comunidad.genero]
        .join(" ")
        .toLowerCase();
      return busqueda && valores.includes(busqueda);
    });

    if (comunidadBuscada) {
      setComunidadActivaId(comunidadBuscada.id);
    }
  }, [busqueda, comunidades]);

  useEffect(() => {
    if (!comunidadActiva?.id) return;
    let cancelado = false;

    async function cargarHilos() {
      setCargandoHilos(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const params = new URLSearchParams({ filtro: filtroActivo });
        if (busqueda && !publicacionCompartida) params.set("q", busqueda);

        const response = await apiRequest(`/api/comunidades/${comunidadActiva.id}/publicaciones?${params.toString()}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );

        if (!response.ok) throw new Error("No se pudieron cargar las publicaciones.");

        const dataHilos = await response.json();
        if (!cancelado) {
          setHilos(dataHilos.map(normalizarHilo));
          setRespuestasAbiertas((abiertas) =>
            abiertas.filter((id) => dataHilos.some((hilo) => hilo.id === id))
          );
        }
      } catch (error) {
        if (!cancelado) {
          setHilos([]);
          mostrarAviso(error.message || "No se pudieron cargar las publicaciones.");
        }
      } finally {
        if (!cancelado) setCargandoHilos(false);
      }
    }

    cargarHilos();

    return () => {
      cancelado = true;
    };
  }, [busqueda, comunidadActiva?.id, filtroActivo, publicacionCompartida]);

  const hilosConAsociaciones = useMemo(
    () =>
      hilos.map((hilo) => ({
        ...hilo,
        eventoAsociado:
          hilo.eventoAsociado ||
          eventosAsociables.find((evento) => String(evento.id) === String(hilo.eventoAsociadoId)) ||
          null,
        reelAsociado:
          hilo.reelAsociado ||
          reelsAsociables.find((reel) => (
            String(reel.id) === String(hilo.reelAsociadoId) ||
            String(reel.backendId) === String(hilo.reelAsociadoId).replace(/^db-/, "")
          )) ||
          null,
      })),
    [eventosAsociables, hilos, reelsAsociables]
  );

  const hilosFiltrados = useMemo(() => {
    return hilosConAsociaciones.filter((hilo) => {
      const textoBusqueda = [
        hilo.op,
        hilo.usuario,
        hilo.tipo,
        hilo.etiqueta,
        hilo.titulo,
        hilo.texto,
      ].join(" ").toLowerCase();

      return Boolean(publicacionCompartida) || !busqueda || textoBusqueda.includes(busqueda);
    });
  }, [busqueda, hilosConAsociaciones, publicacionCompartida]);

  const totalComentarios = useMemo(
    () => hilosFiltrados.reduce((total, hilo) => total + contarComentarios(hilo.comentarios), 0),
    [hilosFiltrados]
  );

  useEffect(() => {
    if (!publicacionCompartida || cargandoHilos) return;
    window.setTimeout(() => {
      document.getElementById(`publicacion-${publicacionCompartida}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [cargandoHilos, hilos, publicacionCompartida]);

  useEffect(() => {
    if (!publicacionCompartida || !comentarioCompartido || cargandoHilos) return;
    const publicacionId = Number(publicacionCompartida);
    setRespuestasAbiertas((abiertas) => abiertas.includes(publicacionId)
      ? abiertas
      : [...abiertas, publicacionId]
    );
    window.setTimeout(() => {
      document.getElementById(`comentario-${comentarioCompartido}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 180);
  }, [cargandoHilos, comentarioCompartido, hilos, publicacionCompartida]);

  const handleChange = (e) => {
    setNuevoHilo({
      ...nuevoHilo,
      [e.target.name]: e.target.value,
    });
  };

  const mostrarAviso = (mensaje) => {
    clearTimeout(avisoTimer.current);
    setAviso(mensaje);
    avisoTimer.current = setTimeout(() => {
      setAviso("");
    }, 2400);
  };

  const pedirLogin = () => {
    mostrarAviso("Tenes que iniciar sesion para publicar en la comunidad");
  };

  const abrirCrearHilo = () => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    if (!comunidadActiva?.unido) {
      mostrarAviso("Unite a este foro antes de crear una publicacion");
      return;
    }

    setMostrarModal(true);
  };

  const alternarMembresia = async () => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para unirte a un foro");
      return;
    }
    if (actualizandoMembresia) return;

    setActualizandoMembresia(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion expiro. Volve a iniciar sesion.");

      const response = await apiRequest(`/api/comunidades/${comunidadActiva.id}/membresia`, {
        method: "POST",
        headers: crearHeadersJson(token),
      });
      const resultado = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resultado.error || "No se pudo actualizar tu membresia.");

      setComunidades((actuales) => actuales.map((comunidad) => (
        comunidad.id === comunidadActiva.id
          ? { ...comunidad, unido: resultado.unido, miembros: resultado.miembros }
          : comunidad
      )));
      if (resultado.unido) {
        mostrarAviso(`Ahora formas parte de s/${mostrarGenero(comunidadActiva.genero)}`);
      } else {
        setMostrarModal(false);
        mostrarAviso(`Saliste de s/${mostrarGenero(comunidadActiva.genero)}`);
      }
    } catch (error) {
      mostrarAviso(error.message || "No se pudo actualizar tu membresia.");
    } finally {
      setActualizandoMembresia(false);
    }
  };

  const copiarEnlace = async (url, mensaje) => {
    try {
      await navigator.clipboard.writeText(url);
      mostrarAviso(mensaje);
    } catch {
      mostrarAviso("No se pudo copiar el enlace en este navegador.");
    }
  };

  const compartirForo = () => {
    const url = new URL("/comunidad", window.location.origin);
    url.searchParams.set("comunidad", comunidadActiva.id);
    copiarEnlace(url.toString(), "Enlace del foro copiado");
  };

  const crearEnlaceContenido = (hiloId, comentarioId = null) => {
    const url = new URL("/comunidad", window.location.origin);
    url.searchParams.set("comunidad", comunidadActiva.id);
    url.searchParams.set("publicacion", hiloId);
    if (comentarioId) url.searchParams.set("comentario", comentarioId);
    return url.toString();
  };

  const actualizarHilo = (id, actualizar) => {
    setHilos((actuales) =>
      actuales.map((hilo) => (hilo.id === id ? actualizar(hilo) : hilo))
    );
  };

  const crearHilo = async (e) => {
    e.preventDefault();
    if (publicandoRef.current) return;

    if (!usuario) {
      pedirLogin();
      return;
    }

    if (!comunidadActiva?.unido) {
      mostrarAviso("Unite a este foro antes de crear una publicacion");
      return;
    }

    const titulo = nuevoHilo.titulo.trim();
    const texto = nuevoHilo.texto.trim();
    if (!titulo || !texto) {
      mostrarAviso("Completa titulo y texto para publicar");
      return;
    }

    publicandoRef.current = true;
    setPublicando(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await apiRequest(`/api/comunidades/${comunidadActivaId}/publicaciones`, {
        method: "POST",
        headers: crearHeadersJson(token),
        body: JSON.stringify({
          titulo,
          texto,
          tipo: nuevoHilo.tipo,
          etiqueta: nuevoHilo.etiqueta || comunidadActiva.genero,
          eventoAsociadoId: nuevoHilo.eventoAsociadoId || null,
          reelAsociadoId: nuevoHilo.reelAsociadoId || null,
        }),
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo publicar en la comunidad.");
      }

      const hiloGuardado = normalizarHilo({
        ...(await response.json()),
        eventoAsociado: eventoAsociadoSeleccionado || undefined,
        reelAsociado: reelAsociadoSeleccionado || undefined,
      });
      setHilos((actuales) => [hiloGuardado, ...actuales]);
      setRespuestasAbiertas((abiertas) => [hiloGuardado.id, ...abiertas]);
      setMostrarModal(false);
      setNuevoHilo({
        titulo: "",
        texto: "",
        tipo: "reciente",
        etiqueta: "",
        eventoAsociadoId: "",
        reelAsociadoId: "",
      });
    } catch (error) {
      mostrarAviso(error.message || "No se pudo publicar en la comunidad.");
    } finally {
      publicandoRef.current = false;
      setPublicando(false);
    }
  };

  const votar = async (id) => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    const hiloAnterior = hilos.find((hilo) => hilo.id === id);
    actualizarHilo(id, (hilo) => {
      const liked = !hilo.liked;
      const likes = Math.max(0, hilo.likes + (liked ? 1 : -1));
      return { ...hilo, liked, likes, votos: likes };
    });

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await apiRequest(`/api/comunidades/publicaciones/${id}/like`, {
        method: "POST",
        headers: crearHeadersJson(token),
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo actualizar el me gusta.");
      }

      const dataLike = await response.json();
      actualizarHilo(id, (hilo) => ({
        ...hilo,
        liked: dataLike.liked,
        likes: dataLike.likes,
        votos: dataLike.votos ?? dataLike.likes,
      }));
    } catch (error) {
      if (hiloAnterior) {
        actualizarHilo(id, () => hiloAnterior);
      }
      mostrarAviso(error.message || "No se pudo actualizar el me gusta.");
    }
  };

  const guardar = async (id) => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    const hiloAnterior = hilos.find((hilo) => hilo.id === id);
    actualizarHilo(id, (hilo) => ({ ...hilo, guardado: !hilo.guardado }));

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await apiRequest(`/api/comunidades/publicaciones/${id}/guardar`, {
        method: "POST",
        headers: crearHeadersJson(token),
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo guardar la publicacion.");
      }

      const dataGuardado = await response.json();
      actualizarHilo(id, (hilo) => ({ ...hilo, guardado: dataGuardado.guardado }));
    } catch (error) {
      if (hiloAnterior) {
        actualizarHilo(id, () => hiloAnterior);
      }
      mostrarAviso(error.message || "No se pudo guardar la publicacion.");
    }
  };

  const toggleRespuestas = (id) => {
    setRespuestasAbiertas((abiertas) =>
      abiertas.includes(id)
        ? abiertas.filter((hiloId) => hiloId !== id)
        : [...abiertas, id]
    );
  };

  const responder = async (hiloId, parentId = null) => {
    const claveEnvio = `${hiloId}:${parentId || "principal"}`;
    if (comentariosEnviandoRef.current.has(claveEnvio)) return;
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = respuestas[claveEnvio]?.trim();
    if (!texto) return;

    comentariosEnviandoRef.current.add(claveEnvio);
    setComentariosEnviando(new Set(comentariosEnviandoRef.current));
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await apiRequest(`/api/comunidades/publicaciones/${hiloId}/comentarios`, {
        method: "POST",
        headers: crearHeadersJson(token),
        body: JSON.stringify({ texto, parentId }),
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo guardar el comentario.");
      }

      const comentarioGuardado = await response.json();
      const comentarioNormalizado = normalizarComentario(comentarioGuardado);
      setHilos((actuales) =>
        actuales.map((hilo) =>
          hilo.id === hiloId
            ? {
                ...hilo,
                comentarios: agregarComentario(hilo.comentarios, parentId, comentarioNormalizado),
              }
            : hilo
        )
      );
      setRespuestas((actuales) => ({ ...actuales, [claveEnvio]: "" }));
      if (parentId) setRespuestaActiva(null);
    } catch (error) {
      mostrarAviso(error.message || "No se pudo guardar el comentario.");
    } finally {
      comentariosEnviandoRef.current.delete(claveEnvio);
      setComentariosEnviando(new Set(comentariosEnviandoRef.current));
    }

    setRespuestasAbiertas((abiertas) => abiertas.includes(hiloId) ? abiertas : [...abiertas, hiloId]);
  };

  const votarComentario = async (hiloId, comentarioId) => {
    const clave = String(comentarioId);
    if (likesComentariosEnviandoRef.current.has(clave)) return;
    if (!usuario) {
      pedirLogin();
      return;
    }

    const hiloAnterior = hilos.find((hilo) => hilo.id === hiloId);
    likesComentariosEnviandoRef.current.add(clave);
    setLikesComentariosEnviando(new Set(likesComentariosEnviandoRef.current));
    actualizarHilo(hiloId, (hilo) => ({
      ...hilo,
      comentarios: actualizarComentario(hilo.comentarios, comentarioId, (comentario) => {
        const liked = !comentario.liked;
        const likes = Math.max(0, comentario.likes + (liked ? 1 : -1));
        return { ...comentario, liked, likes, votos: likes };
      }),
    }));

    try {
      const { data } = await supabase.auth.getSession();
      const response = await apiRequest(`/api/comunidades/comentarios/${comentarioId}/like`, {
        method: "POST",
        headers: crearHeadersJson(data.session?.access_token),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo actualizar el me gusta.");
      actualizarHilo(hiloId, (hilo) => ({
        ...hilo,
        comentarios: actualizarComentario(hilo.comentarios, comentarioId, (comentario) => ({
          ...comentario,
          liked: body.liked,
          likes: body.likes,
          votos: body.votos ?? body.likes,
        })),
      }));
    } catch (error) {
      if (hiloAnterior) actualizarHilo(hiloId, () => hiloAnterior);
      mostrarAviso(error.message || "No se pudo actualizar el me gusta.");
    } finally {
      likesComentariosEnviandoRef.current.delete(clave);
      setLikesComentariosEnviando(new Set(likesComentariosEnviandoRef.current));
    }
  };

  const denunciarContenido = async ({ motivo, detalle }) => {
    if (!denunciaPendiente || !usuario) return;
    const { tipo, hilo, comentario } = denunciaPendiente;
    const esComentario = tipo === "comentario";
    const contenidoId = esComentario ? comentario.id : hilo.id;
    const endpoint = esComentario
      ? `/api/comunidades/comentarios/${contenidoId}/denunciar`
      : `/api/comunidades/publicaciones/${contenidoId}/denunciar`;

    setEnviandoDenuncia(true);
    try {
      const { data } = await supabase.auth.getSession();
      const response = await apiRequest(endpoint, {
        method: "POST",
        headers: crearHeadersJson(data.session?.access_token),
        body: JSON.stringify({ reason: motivo, detail: detalle }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo registrar la denuncia.");
      setDenunciaPendiente(null);
      if (body.nuevaDenuncia === false) {
        mostrarAviso("Ya habias denunciado este contenido.");
        return;
      }

      try {
        await avisarDenunciaASoporte({
          tipo: esComentario ? "comentario de comunidad" : "publicacion de comunidad",
          contenidoId,
          titulo: esComentario ? `Comentario en ${hilo.titulo}` : hilo.titulo,
          autor: esComentario ? comentario.usuario || comentario.autor : hilo.usuario || hilo.op,
          motivo: etiquetaMotivoDenuncia(motivo),
          detalle,
          nombreUsuario: usuario.user_metadata?.username || usuario.email?.split("@")[0],
          url: crearEnlaceContenido(hilo.id, esComentario ? comentario.id : null),
        });
        mostrarAviso("Denuncia registrada y enviada a soporte.");
      } catch (emailError) {
        console.error("Email de denuncia de comunidad:", emailError);
        mostrarAviso("La denuncia fue registrada, pero no se pudo enviar el email.");
      }
    } catch (error) {
      mostrarAviso(error.message || "No se pudo registrar la denuncia.");
    } finally {
      setEnviandoDenuncia(false);
    }
  };

  const irARecursoForo = (recursoId) => {
    const genero = comunidadActiva.genero || comunidadActiva.id;
    if (recursoId === "eventos") {
      navigate(`/?genero=${encodeURIComponent(genero)}`);
      return;
    }

    if (recursoId === "reels") {
      navigate(`/descubrir?genero=${encodeURIComponent(genero)}`);
    }
  };

  const alternarReelAsociado = (reel) => {
    const audio = audioAsociadoRef.current;
    if (!audio || !reel?.audio) return;

    if (reelAsociadoActivo === reel.id && !audio.paused) {
      audio.pause();
      setReelAsociadoActivo(null);
      return;
    }

    if (audio.src !== reel.audio) {
      audio.src = reel.audio;
      audio.load();
    }

    audio.play()
      .then(() => setReelAsociadoActivo(reel.id))
      .catch(() => mostrarAviso("No se pudo reproducir este reel."));
  };

  const renderizarComentario = (hilo, comentario, nivel = 0) => {
    const claveRespuesta = `${hilo.id}:${comentario.id}`;
    const esPropio = usuario?.id && comentario.userId === usuario.id;
    const esDestino = String(comentario.id) === String(comentarioCompartido);
    return (
      <article
        className={`respuesta-card ${esDestino ? "notificacion-destino" : ""}`}
        id={`comentario-${comentario.id}`}
        key={comentario.id}
        style={{ "--nivel-respuesta": Math.min(nivel, 3) }}
      >
        <div className="respuesta-linea" />
        <div className="respuesta-contenido">
          <div className="respuesta-meta">
            <strong>{comentario.usuario}</strong>
            <span>{comentario.autor}</span>
            <span>{comentario.tiempo || "ahora"}</span>
          </div>
          <p><TextoConMenciones texto={comentario.texto} /></p>
          <div className="respuesta-acciones">
            <button
              className={`respuesta-like ${comentario.liked ? "activo" : ""}`}
              type="button"
              aria-pressed={Boolean(comentario.liked)}
              onClick={() => votarComentario(hilo.id, comentario.id)}
              disabled={likesComentariosEnviando.has(String(comentario.id))}
            >
              <span aria-hidden="true">{comentario.liked ? "♥" : "♡"}</span>
              {comentario.likes}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!usuario) return pedirLogin();
                setRespuestaActiva((actual) => actual === claveRespuesta ? null : claveRespuesta);
              }}
            >
              Responder
            </button>
            {!esPropio ? (
              <button
                className="respuesta-denunciar"
                type="button"
                onClick={() => {
                  if (!usuario) return pedirLogin();
                  setDenunciaPendiente({ tipo: "comentario", hilo, comentario });
                }}
              >
                Denunciar
              </button>
            ) : null}
          </div>

          {respuestaActiva === claveRespuesta ? (
            <div className="respuesta-form respuesta-form-anidada">
              <CampoMenciones
                placeholder={`Responder a ${comentario.usuario}`}
                value={respuestas[claveRespuesta] || ""}
                onChange={(texto) => setRespuestas((actuales) => ({ ...actuales, [claveRespuesta]: texto }))}
              />
              <button
                type="button"
                onClick={() => responder(hilo.id, comentario.id)}
                disabled={comentariosEnviando.has(claveRespuesta)}
              >
                {comentariosEnviando.has(claveRespuesta) ? "Enviando..." : "Enviar"}
              </button>
            </div>
          ) : null}

          {comentario.respuestas.length > 0 ? (
            <div className="respuestas-anidadas">
              {comentario.respuestas.map((respuesta) => renderizarComentario(hilo, respuesta, nivel + 1))}
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <main className="comunidad-container">
      <section className="comunidad-layout reddit-layout">
        <aside className="comunidad-sidebar subreddit-list">
          <section className="comunidad-panel comunidad-panel-lista">
            <h2>Foros SONDAR</h2>
            <div className="comunidades-lista">
              {comunidades.map((comunidad) => (
                <button
                  className={`comunidad-mini-card ${comunidadActivaId === comunidad.id ? "activa" : ""}`}
                  key={comunidad.id}
                  type="button"
                  onClick={() => setComunidadActivaId(comunidad.id)}
                >
                  <div className="comunidad-mini-icon">
                    {comunidad.titulo.charAt(0)}
                  </div>
                  <div>
                    <strong>s/{mostrarGenero(comunidad.genero)}</strong>
                    <span>{comunidad.publicaciones || 0} publicaciones</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="comunidad-main">
          <header className="comunidad-portada">
            <div
              className="comunidad-cover"
              style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.18)), url(${comunidadActiva.portada})` }}
            ></div>
            <div className="comunidad-identidad">
              <div className="comunidad-logo">{comunidadActiva.titulo.charAt(0)}</div>
              <div className="comunidad-titulos">
                <h1>s/{mostrarGenero(comunidadActiva.genero)}</h1>
                <p>{comunidadActiva.descripcion}</p>
                <div className="comunidad-miembros">
                  <strong>{comunidadActiva.miembros || 0}</strong>
                  <span>miembros</span>
                  <strong>{comunidadActiva.publicaciones || 0}</strong>
                  <span>publicaciones</span>
                  <strong>{totalComentarios}</strong>
                  <span>respuestas</span>
                </div>
              </div>
              <div className="comunidad-header-actions">
                <button
                  className="comunidad-crear"
                  type="button"
                  onClick={abrirCrearHilo}
                  disabled={!usuario || !comunidadActiva.unido}
                  title={!usuario ? "Inicia sesion y unite al foro para publicar" : !comunidadActiva.unido ? "Unite al foro para publicar" : "Crear una publicacion"}
                >
                  <span aria-hidden="true">+</span>
                  {comunidadActiva.unido ? "Crear post" : "Unite para publicar"}
                </button>
                <button
                  className={`comunidad-unirse ${comunidadActiva.unido ? "activa" : ""}`}
                  type="button"
                  onClick={alternarMembresia}
                  disabled={actualizandoMembresia}
                  aria-pressed={Boolean(comunidadActiva.unido)}
                >
                  {actualizandoMembresia ? "Actualizando..." : comunidadActiva.unido ? "Salir del foro" : "Unirse"}
                </button>
                <button className="comunidad-mas" type="button" aria-label="Copiar enlace del foro" onClick={compartirForo}>
                  Compartir
                </button>
              </div>
            </div>
          </header>

          <div className="comunidad-toolbar">
            <div className="comunidad-filtro-dropdown" ref={filtroRef}>
              <button
                className={`comunidad-filtro-trigger filtro-${filtroActivo}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={mostrarFiltros}
                onClick={() => setMostrarFiltros((valor) => !valor)}
              >
                <span className="comunidad-filtro-prefijo">Filtrar por:</span> {filtroSeleccionado.label}
                <span aria-hidden="true">v</span>
              </button>
              {mostrarFiltros ? (
                <div className="comunidad-filtros-menu" role="menu" aria-label="Filtros de publicaciones">
                  {filtros.map((filtro) => (
                    <button
                      key={filtro.id}
                      className={filtroActivo === filtro.id ? "activo" : ""}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setFiltroActivo(filtro.id);
                        setMostrarFiltros(false);
                      }}
                    >
                      <strong>
                        <span className="filtro-check" aria-hidden="true">
                          {filtroActivo === filtro.id ? "✓" : ""}
                        </span>
                        {filtro.label}
                      </strong>
                      <span>
                        {filtro.id === "destacado" && "Ordena por relevancia y actividad"}
                        {filtro.id === "reciente" && "Ordena de nuevas a antiguas"}
                        {filtro.id === "popular" && "Ordena por votos y respuestas"}
                        {filtro.id === "preguntas" && "Muestra unicamente consultas"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="comunidad-toolbar-meta">
              <span>{hilosFiltrados.length} posts</span>
              <span>{mostrarGenero(comunidadActiva.genero)}</span>
            </div>
          </div>

          <div className="comunidad-feed">
            <section className="comunidad-highlights">
              <div className="highlight-card">
                <strong>Bienvenido a s/{mostrarGenero(comunidadActiva.genero)}</strong>
                <p>Comparte lanzamientos, eventos, dudas y recomendaciones para que este foro se mantenga util para la escena.</p>
              </div>
            </section>

            {cargandoHilos && (
              <div className="comunidad-vacio">
                Cargando publicaciones...
              </div>
            )}

            {!cargandoHilos && hilosFiltrados.map((hilo) => (
              <article
                className={`publicacion-card hilo-card ${String(hilo.id) === publicacionCompartida ? "notificacion-destino" : ""}`}
                id={`publicacion-${hilo.id}`}
                key={hilo.id}
              >
                <div className="publicacion-contenido">
                  <div className="post-author-row">
                    <div className="publicacion-avatar post-avatar">
                      {(hilo.op || hilo.usuario || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="publicacion-meta post-meta">
                      <strong>{hilo.usuario}</strong>
                      <span>{hilo.op}</span>
                      <span>{hilo.tiempo || "ahora"}</span>
                    </div>
                    {usuario?.id && hilo.userId !== usuario.id ? (
                      <button
                        className="post-menu post-denunciar"
                        type="button"
                        onClick={() => setDenunciaPendiente({ tipo: "publicacion", hilo })}
                      >
                        Denunciar
                      </button>
                    ) : null}
                  </div>

                  <div className="publicacion-meta etiquetas-row">
                    <span>{hilo.etiqueta || comunidadActiva.genero}</span>
                    <span>{filtros.find((filtro) => filtro.id === hilo.tipo)?.label || hilo.tipo}</span>
                  </div>

                  <h2>{hilo.titulo}</h2>
                  <p><TextoConMenciones texto={hilo.texto} /></p>

                  {hilo.eventoAsociado ? (
                    <button
                      className="publicacion-asociada publicacion-asociada-evento"
                      type="button"
                      onClick={() => navigate(`/?evento=${encodeURIComponent(hilo.eventoAsociado.id)}`)}
                    >
                      <span className="asociada-icono">E</span>
                      <span>
                        <small>Evento asociado</small>
                        <strong>{hilo.eventoAsociado.titulo}</strong>
                        <em>{hilo.eventoAsociado.lugar || hilo.eventoAsociado.ubicacion || "Lugar a confirmar"} · {formatearFechaCorta(hilo.eventoAsociado.fecha)}</em>
                      </span>
                    </button>
                  ) : null}

                  {hilo.reelAsociado ? (
                    <div className="publicacion-asociada publicacion-asociada-reel">
                      <img src={hilo.reelAsociado.portada || "/sondar-icon.png"} alt="" />
                      <span>
                        <small>Tema asociado</small>
                        <strong>{hilo.reelAsociado.tema || hilo.reelAsociado.album}</strong>
                        <em>{hilo.reelAsociado.artista || hilo.reelAsociado.usuario} · {hilo.reelAsociado.album || mostrarGenero(hilo.reelAsociado.genero)}</em>
                      </span>
                      <button
                        type="button"
                        onClick={() => alternarReelAsociado(hilo.reelAsociado)}
                        disabled={!hilo.reelAsociado.audio}
                        aria-label={reelAsociadoActivo === hilo.reelAsociado.id ? "Pausar tema asociado" : "Reproducir tema asociado"}
                      >
                        {reelAsociadoActivo === hilo.reelAsociado.id ? "II" : "Play"}
                      </button>
                      <button
                        className="asociada-abrir"
                        type="button"
                        onClick={() => navigate(`/descubrir?lanzamiento=${encodeURIComponent(hilo.reelAsociado.id)}`)}
                      >
                        Abrir
                      </button>
                    </div>
                  ) : null}

                  <div className="publicacion-acciones">
                    <button
                      className={`publicacion-like ${hilo.liked ? "activo" : ""}`}
                      type="button"
                      onClick={() => votar(hilo.id)}
                      aria-label={hilo.liked ? "Quitar me gusta" : "Me gusta"}
                      aria-pressed={Boolean(hilo.liked)}
                    >
                      <span className="like-icon" aria-hidden="true">{hilo.liked ? "♥" : "♡"}</span>
                      {hilo.votos}
                    </button>
                    <button
                      className={respuestasAbiertas.includes(hilo.id) ? "activo" : ""}
                      type="button"
                      onClick={() => toggleRespuestas(hilo.id)}
                    >
                      {contarComentarios(hilo.comentarios)} respuestas
                    </button>
                    <button
                      className={hilo.guardado ? "activo" : ""}
                      type="button"
                      onClick={() => guardar(hilo.id)}
                    >
                      {hilo.guardado ? "Guardado" : "Guardar"}
                    </button>
                  </div>

                  {respuestasAbiertas.includes(hilo.id) && (
                    <section className="hilo-respuestas">
                      {hilo.comentarios.map((comentario) => renderizarComentario(hilo, comentario))}

                      <div className="respuesta-form">
                        <CampoMenciones
                          placeholder="Responde o menciona con @usuario"
                          value={respuestas[`${hilo.id}:principal`] || ""}
                          onChange={(texto) => setRespuestas((actuales) => ({
                            ...actuales,
                            [`${hilo.id}:principal`]: texto,
                          }))}
                        />
                        <button type="button" onClick={() => responder(hilo.id)} disabled={comentariosEnviando.has(`${hilo.id}:principal`)}>
                          {comentariosEnviando.has(`${hilo.id}:principal`) ? "Enviando..." : "Responder"}
                        </button>
                      </div>
                    </section>
                  )}
                </div>
              </article>
            ))}

            {!cargandoHilos && hilosFiltrados.length === 0 && (
              <div className="comunidad-vacio">
                No hay publicaciones para ese filtro en esta comunidad.
              </div>
            )}
          </div>
        </div>

        <aside className="comunidad-sidebar detalle-comunidad">
          <section className="comunidad-panel">
            <h2>Reglas del foro</h2>
            <ol className="comunidad-reglas">
              {reglasForo.map((regla) => (
                <li key={regla}>{regla}</li>
              ))}
            </ol>
          </section>

          <section className="comunidad-panel">
            <h2>Recursos</h2>
            <div className="comunidad-bookmarks">
              {recursosForo.map((recurso) => (
                <button key={recurso.id} type="button" onClick={() => irARecursoForo(recurso.id)}>
                  {recurso.label}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </section>

      {mostrarModal && (
        <div className="comunidad-modal-overlay">
          <div className="comunidad-modal">
            <header className="comunidad-modal-header">
              <div>
                <h2>Crear post</h2>
                <p>s/{mostrarGenero(comunidadActiva.genero)}</p>
              </div>
              <button className="comunidad-modal-cerrar" type="button" onClick={() => setMostrarModal(false)} aria-label="Cerrar">
                x
              </button>
            </header>

            <form className="comunidad-post-form" onSubmit={crearHilo}>
              <label className="comunidad-post-campo">
                <span>Titulo</span>
                <input
                  name="titulo"
                  placeholder="Titulo de la publicacion"
                  value={nuevoHilo.titulo}
                  onChange={handleChange}
                  maxLength="300"
                  required
                />
                <small>{nuevoHilo.titulo.length}/300</small>
              </label>

              <div className="comunidad-asociaciones-form">
                <label>
                  <span>Tipo de publicacion</span>
                  <select name="tipo" value={nuevoHilo.tipo} onChange={handleChange}>
                    <option value="reciente">Publicacion general</option>
                    <option value="preguntas">Pregunta</option>
                  </select>
                </label>
                <label>
                  <span>Evento asociado (opcional)</span>
                  <select name="eventoAsociadoId" value={nuevoHilo.eventoAsociadoId} onChange={handleChange}>
                    <option value="">Sin evento asociado</option>
                    {eventosDelGenero.map((evento) => (
                      <option key={evento.id} value={evento.id}>
                        {evento.titulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tema asociado (opcional)</span>
                  <select name="reelAsociadoId" value={nuevoHilo.reelAsociadoId} onChange={handleChange}>
                    <option value="">Sin tema asociado</option>
                    {reelsDelGenero.map((reel) => (
                      <option key={reel.id} value={reel.id}>
                        {reel.tema || reel.album || reel.artista}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="comunidad-post-campo">
                <span>Descripcion</span>
                <CampoMenciones
                  placeholder={`Escribi en ${comunidadActiva.nombre} o menciona con @usuario`}
                  value={nuevoHilo.texto}
                  onChange={(texto) => setNuevoHilo((actual) => ({ ...actual, texto }))}
                  required
                />
              </label>

              <div className="comunidad-modal-botones">
                <button type="button" onClick={() => setMostrarModal(false)}>Cancelar</button>
                <button type="submit" disabled={publicando}>{publicando ? "Publicando..." : "Post"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <audio ref={audioAsociadoRef} onEnded={() => setReelAsociadoActivo(null)} />

      <DenunciaModal
        abierto={Boolean(denunciaPendiente)}
        titulo={denunciaPendiente?.comentario?.texto || denunciaPendiente?.hilo?.titulo}
        enviando={enviandoDenuncia}
        onClose={() => setDenunciaPendiente(null)}
        onConfirm={denunciarContenido}
      />

      {aviso && (
        <div className="comunidad-toast" role="status">
          {aviso}
        </div>
      )}
    </main>
  );
}
