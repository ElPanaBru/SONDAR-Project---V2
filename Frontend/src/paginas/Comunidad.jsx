import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import CampoMenciones from "../componentes/CampoMenciones";
import TextoConMenciones from "../componentes/TextoConMenciones";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./comunidad.css";

const filtros = [
  { id: "destacado", label: "Destacado" },
  { id: "reciente", label: "Mas reciente" },
  { id: "popular", label: "Mas popular" },
  { id: "preguntas", label: "Preguntas" },
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

const miembrosActivos = ["S", "O", "N", "D", "R"];

const hilosIniciales = [
  {
    id: 1,
    comunidadId: "rock",
    op: "SONDAR",
    usuario: "@sondar",
    tipo: "destacado",
    titulo: "Que bandas nuevas de rock estan siguiendo?",
    texto: "Armen una lista con artistas para descubrir esta semana.",
    etiqueta: "rock",
    votos: 24,
    likes: 24,
    liked: false,
    guardado: false,
    tiempo: "hace 2 h",
    comentarios: [
      { id: 11, autor: "Lula", usuario: "@lula_fan", texto: "Marea Gris viene sonando fuerte.", votos: 8, likes: 8, respuestas: [] },
    ],
  },
  {
    id: 2,
    comunidadId: "trap",
    op: "SONDAR",
    usuario: "@sondar",
    tipo: "preguntas",
    titulo: "Productores de trap para colaborar",
    texto: "Dejen beats, referencias o busquedas de feats para conectar con otros usuarios.",
    etiqueta: "trap",
    votos: 18,
    likes: 18,
    liked: false,
    guardado: false,
    tiempo: "hace 4 h",
    comentarios: [],
  },
  {
    id: 3,
    comunidadId: "edm",
    op: "SONDAR",
    usuario: "@sondar",
    tipo: "popular",
    titulo: "Sets favoritos para estudiar produccion",
    texto: "Compartan sets o tracks que sirvan para analizar transiciones, drops y mezcla.",
    etiqueta: "edm",
    votos: 31,
    likes: 31,
    liked: false,
    guardado: true,
    tiempo: "hace 1 d",
    comentarios: [],
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

const normalizarHilo = (hilo) => ({
  ...hilo,
  votos: Number(hilo.votos ?? hilo.likes ?? 0),
  likes: Number(hilo.likes ?? hilo.votos ?? 0),
  comentarios: (hilo.comentarios || []).map((comentario) => ({
    ...comentario,
    votos: Number(comentario.votos ?? comentario.likes ?? 0),
    likes: Number(comentario.likes ?? comentario.votos ?? 0),
    respuestas: comentario.respuestas || [],
  })),
});

export default function Comunidad({ usuario }) {
  const { t } = usePreferencias();
  const [searchParams] = useSearchParams();
  const siguienteComentarioId = useRef(1000);
  const avisoTimer = useRef(null);
  const publicandoRef = useRef(false);
  const comentariosEnviandoRef = useRef(new Set());
  const busqueda = searchParams.get("comunidad")?.toLowerCase() || "";
  const publicacionCompartida = searchParams.get("publicacion");
  const [comunidades, setComunidades] = useState(comunidadesPorGenero);
  const [comunidadActivaId, setComunidadActivaId] = useState("pop");
  const [filtroActivo, setFiltroActivo] = useState("destacado");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [hilos, setHilos] = useState(hilosIniciales.map(normalizarHilo));
  const [cargandoHilos, setCargandoHilos] = useState(false);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [aviso, setAviso] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [comentariosEnviando, setComentariosEnviando] = useState(new Set());
  const [nuevoHilo, setNuevoHilo] = useState({
    titulo: "",
    texto: "",
    tipo: "reciente",
    etiqueta: "",
  });

  const comunidadActiva = useMemo(
    () => comunidades.find((comunidad) => comunidad.id === comunidadActivaId) || comunidades[0],
    [comunidadActivaId, comunidades]
  );

  useEffect(() => {
    return () => {
      clearTimeout(avisoTimer.current);
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
          const locales = hilosIniciales
            .map(normalizarHilo)
            .filter((hilo) => hilo.comunidadId === comunidadActiva.id);
          setHilos(locales);
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

  const hilosFiltrados = useMemo(() => {
    return hilos.filter((hilo) => {
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
  }, [busqueda, hilos, publicacionCompartida]);

  useEffect(() => {
    if (!publicacionCompartida || cargandoHilos) return;
    window.setTimeout(() => {
      document.getElementById(`publicacion-${publicacionCompartida}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [cargandoHilos, hilos, publicacionCompartida]);

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

    setMostrarModal(true);
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
        }),
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo publicar en la comunidad.");
      }

      const hiloGuardado = normalizarHilo(await response.json());
      setHilos((actuales) => [hiloGuardado, ...actuales]);
      setRespuestasAbiertas((abiertas) => [hiloGuardado.id, ...abiertas]);
      setMostrarModal(false);
      setNuevoHilo({
        titulo: "",
        texto: "",
        tipo: "reciente",
        etiqueta: "",
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

  const responder = async (hiloId) => {
    const claveEnvio = String(hiloId);
    if (comentariosEnviandoRef.current.has(claveEnvio)) return;
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = respuestas[hiloId]?.trim();
    if (!texto) return;

    comentariosEnviandoRef.current.add(claveEnvio);
    setComentariosEnviando(new Set(comentariosEnviandoRef.current));
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const response = await apiRequest(`/api/comunidades/publicaciones/${hiloId}/comentarios`, {
        method: "POST",
        headers: crearHeadersJson(token),
        body: JSON.stringify({ texto }),
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo guardar el comentario.");
      }

      const comentarioGuardado = await response.json();
      setHilos((actuales) =>
        actuales.map((hilo) =>
          hilo.id === hiloId
            ? {
                ...hilo,
                comentarios: [...hilo.comentarios, normalizarHilo({ comentarios: [comentarioGuardado] }).comentarios[0]],
              }
            : hilo
        )
      );
    } catch (error) {
      const comentarioLocal = {
        id: siguienteComentarioId.current,
        autor: usuario?.user_metadata?.username || usuario?.email?.split("@")[0] || "Usuario SONDAR",
        usuario: usuario?.email ? `@${usuario.email.split("@")[0]}` : "@usuario",
        texto,
        votos: 0,
        likes: 0,
        respuestas: [],
      };
      siguienteComentarioId.current += 1;
      setHilos((actuales) =>
        actuales.map((hilo) =>
          hilo.id === hiloId
            ? { ...hilo, comentarios: [...hilo.comentarios, comentarioLocal] }
            : hilo
        )
      );
      mostrarAviso(error.message || "Comentario local hasta reconectar.");
    } finally {
      comentariosEnviandoRef.current.delete(claveEnvio);
      setComentariosEnviando(new Set(comentariosEnviandoRef.current));
    }

    setRespuestas({ ...respuestas, [hiloId]: "" });
    setRespuestasAbiertas((abiertas) => abiertas.includes(hiloId) ? abiertas : [...abiertas, hiloId]);
  };

  return (
    <main className="comunidad-container">
      <section className="comunidad-layout reddit-layout">
        <aside className="comunidad-sidebar subreddit-list">
          <section className="comunidad-panel">
            <h2>{t("Géneros")}</h2>
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
                    <strong>{comunidad.nombre}</strong>
                    <span>{comunidad.publicaciones || 0} publicaciones</span>
                    <p>{comunidad.actividad}</p>
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
              style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(3, 3, 3, 0.72)), url(${comunidadActiva.portada})` }}
            ></div>
            <div className="comunidad-identidad">
              <div className="comunidad-logo">{comunidadActiva.titulo.charAt(0)}</div>
              <div className="comunidad-titulos">
                <span className="comunidad-eyebrow">{comunidadActiva.nombre}</span>
                <h1>Comunidad {mostrarGenero(comunidadActiva.genero)}</h1>
                <p>{comunidadActiva.descripcion}</p>
                <div className="comunidad-miembros">
                  <div className="miembros-stack" aria-hidden="true">
                    {miembrosActivos.map((miembro) => (
                      <span key={miembro}>{miembro}</span>
                    ))}
                  </div>
                  <strong>{comunidadActiva.publicaciones || 0}</strong>
                  <span>publicaciones - Comunidad por genero</span>
                </div>
              </div>
              <button className="comunidad-crear" type="button" onClick={abrirCrearHilo}>
                <span aria-hidden="true">+</span>
                Crear publicacion
              </button>
            </div>
          </header>

          <div className="comunidad-filtros" aria-label="Filtros de publicaciones">
            {filtros.map((filtro) => (
              <button
                key={filtro.id}
                className={filtroActivo === filtro.id ? "activo" : ""}
                type="button"
                onClick={() => setFiltroActivo(filtro.id)}
              >
                {filtro.label}
              </button>
            ))}
          </div>

          <div className="comunidad-feed">
            <section className="comunidad-composer" onClick={abrirCrearHilo}>
              <div className="publicacion-avatar">
                {(usuario?.user_metadata?.username || usuario?.email || "S").charAt(0).toUpperCase()}
              </div>
              <div className="composer-cuerpo">
                <button type="button">Escribir en {comunidadActiva.nombre}</button>
                <div className="composer-acciones">
                  <span>Pregunta</span>
                  <span>Comentario</span>
                  <strong>Publicar</strong>
                </div>
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
                <div className="hilo-votos">
                  <button
                    className={hilo.liked ? "activo" : ""}
                    type="button"
                    onClick={() => votar(hilo.id)}
                    aria-label={hilo.liked ? "Quitar me gusta" : "Me gusta"}
                  >
                    +
                  </button>
                  <strong>{hilo.votos}</strong>
                </div>

                <div className="publicacion-contenido">
                  <div className="publicacion-meta">
                    <strong>{hilo.usuario}</strong>
                    <span>{hilo.op}</span>
                    <span>{hilo.tiempo || "ahora"}</span>
                    <span>{hilo.etiqueta || comunidadActiva.genero}</span>
                  </div>

                  <h2>{hilo.titulo}</h2>
                  <p><TextoConMenciones texto={hilo.texto} /></p>

                  <div className="publicacion-acciones">
                    <button
                      className={respuestasAbiertas.includes(hilo.id) ? "activo" : ""}
                      type="button"
                      onClick={() => toggleRespuestas(hilo.id)}
                    >
                      {hilo.comentarios.length} respuestas
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
                      {hilo.comentarios.map((comentario) => (
                        <article className="respuesta-card" key={comentario.id}>
                          <div className="respuesta-linea"></div>
                          <div>
                            <div className="respuesta-meta">
                              <strong>{comentario.usuario}</strong>
                              <span>{comentario.autor}</span>
                              <span>{comentario.votos} votos</span>
                            </div>
                            <p><TextoConMenciones texto={comentario.texto} /></p>
                          </div>
                        </article>
                      ))}

                      <div className="respuesta-form">
                        <CampoMenciones
                          placeholder="Respondé o mencioná con @usuario"
                          value={respuestas[hilo.id] || ""}
                          onChange={(texto) => setRespuestas({ ...respuestas, [hilo.id]: texto })}
                        />
                        <button type="button" onClick={() => responder(hilo.id)} disabled={comentariosEnviando.has(String(hilo.id))}>
                          {comentariosEnviando.has(String(hilo.id)) ? "Enviando..." : "Responder"}
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
          <section className="comunidad-panel comunidad-panel-acento">
            <h2>Acerca de {comunidadActiva.nombre}</h2>
            <p>{comunidadActiva.descripcion}</p>
            <div className="subreddit-stats">
              <strong>{comunidadActiva.publicaciones || 0}</strong>
              <span>publicaciones</span>
              <strong>{mostrarGenero(comunidadActiva.genero)}</strong>
              <span>genero</span>
            </div>
          </section>
        </aside>
      </section>

      {mostrarModal && (
        <div className="comunidad-modal-overlay">
          <div className="comunidad-modal">
            <h2>{t("Crear publicación")}</h2>
            <form onSubmit={crearHilo}>
              <input
                name="titulo"
                placeholder="Titulo de la publicacion"
                value={nuevoHilo.titulo}
                onChange={handleChange}
                required
              />

              <CampoMenciones
                placeholder={`Escribí en ${comunidadActiva.nombre} o mencioná con @usuario`}
                value={nuevoHilo.texto}
                onChange={(texto) => setNuevoHilo((actual) => ({ ...actual, texto }))}
                required
              />

              <div className="comunidad-form-row">
                <select name="tipo" value={nuevoHilo.tipo} onChange={handleChange}>
                  {filtros.map((filtro) => (
                    <option key={filtro.id} value={filtro.id}>{filtro.label}</option>
                  ))}
                </select>
                <input
                  name="etiqueta"
                  placeholder={`Etiqueta (${comunidadActiva.genero})`}
                  value={nuevoHilo.etiqueta}
                  onChange={handleChange}
                />
              </div>

              <div className="comunidad-modal-botones">
                <button type="submit" disabled={publicando}>{publicando ? "Publicando..." : "Publicar"}</button>
                <button type="button" onClick={() => setMostrarModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {aviso && (
        <div className="comunidad-toast" role="status">
          {aviso}
        </div>
      )}
    </main>
  );
}
