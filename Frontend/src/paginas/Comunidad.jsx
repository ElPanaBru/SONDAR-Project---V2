import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { backendFetchJson } from "../lib/backendClient";
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

const miembrosActivos = ["S", "O", "N", "D", "R"];

const mostrarGenero = (genero) => {
  if (!genero) return "";
  return genero === "edm" ? "EDM" : genero.charAt(0).toUpperCase() + genero.slice(1);
};

const normalizarHilo = (hilo) => ({
  ...hilo,
  votos: Number(hilo.votos ?? hilo.likes ?? 0),
  likes: Number(hilo.likes ?? hilo.votos ?? 0),
  comentarios: (hilo.comentarios || []).map(normalizarComentario),
});

function normalizarComentario(comentario) {
  return {
    ...comentario,
    votos: Number(comentario.votos ?? comentario.likes ?? 0),
    likes: Number(comentario.likes ?? comentario.votos ?? 0),
    respuestas: (comentario.respuestas || []).map(normalizarComentario),
  };
}

function actualizarComentario(comentarios, comentarioId, actualizar) {
  return comentarios.map((comentario) => {
    if (comentario.id === comentarioId) return actualizar(comentario);
    return {
      ...comentario,
      respuestas: actualizarComentario(comentario.respuestas || [], comentarioId, actualizar),
    };
  });
}

function agregarComentario(comentarios, parentId, comentarioNuevo) {
  if (!parentId) return [...comentarios, comentarioNuevo];

  return comentarios.map((comentario) => {
    if (comentario.id === parentId) {
      return {
        ...comentario,
        respuestas: [...(comentario.respuestas || []), comentarioNuevo],
      };
    }

    return {
      ...comentario,
      respuestas: agregarComentario(comentario.respuestas || [], parentId, comentarioNuevo),
    };
  });
}

export default function Comunidad({ usuario }) {
  const { t } = usePreferencias();
  const [searchParams] = useSearchParams();
  const avisoTimer = useRef(null);
  const busqueda = searchParams.get("comunidad")?.toLowerCase() || "";
  const publicacionCompartida = searchParams.get("publicacion");
  const [comunidades, setComunidades] = useState([]);
  const [comunidadActivaId, setComunidadActivaId] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("destacado");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [hilos, setHilos] = useState([]);
  const [cargandoComunidades, setCargandoComunidades] = useState(true);
  const [cargandoHilos, setCargandoHilos] = useState(false);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([]);
  const [respuestaActiva, setRespuestaActiva] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [aviso, setAviso] = useState("");
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
        const dataComunidades = await backendFetchJson("/api/comunidades");
        if (!cancelado && dataComunidades.length > 0) {
          setComunidades(dataComunidades);
          setComunidadActivaId((actual) =>
            dataComunidades.some((comunidad) => comunidad.id === actual)
              ? actual
              : dataComunidades[0].id
          );
        } else if (!cancelado) {
          setComunidades([]);
          setComunidadActivaId("");
        }
      } catch (error) {
        if (!cancelado) {
          setComunidades([]);
          setComunidadActivaId("");
          mostrarAviso(error.message || "No se pudieron cargar las comunidades.");
        }
      } finally {
        if (!cancelado) setCargandoComunidades(false);
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
        const params = new URLSearchParams({
          filtro: publicacionCompartida ? "destacado" : filtroActivo,
          limit: "50",
        });
        if (busqueda && !publicacionCompartida) params.set("q", busqueda);

        const dataHilos = await backendFetchJson(
          `/api/comunidades/${comunidadActiva.id}/publicaciones?${params.toString()}`
        );
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

    if (!comunidadActiva) {
      mostrarAviso("No hay una comunidad disponible para publicar.");
      return;
    }

    setMostrarModal(true);
  };

  const actualizarHilo = (id, actualizar) => {
    setHilos((actuales) =>
      actuales.map((hilo) => (hilo.id === id ? actualizar(hilo) : hilo))
    );
  };

  const actualizarComunidad = (id, actualizar) => {
    setComunidades((actuales) =>
      actuales.map((comunidad) => (comunidad.id === id ? actualizar(comunidad) : comunidad))
    );
  };

  const alternarUnion = async () => {
    if (!usuario) {
      mostrarAviso("Tenes que iniciar sesion para unirte a una comunidad");
      return;
    }

    try {
      const dataUnion = await backendFetchJson(`/api/comunidades/${comunidadActiva.id}/unirse`, {
        method: "POST",
      });

      actualizarComunidad(comunidadActiva.id, (comunidad) => ({
        ...comunidad,
        unido: dataUnion.unido,
        miembros: dataUnion.miembros,
        publicaciones: dataUnion.publicaciones,
      }));

      mostrarAviso(dataUnion.unido ? `Te uniste a ${comunidadActiva.nombre}` : `Saliste de ${comunidadActiva.nombre}`);
    } catch (error) {
      mostrarAviso(error.message || "No se pudo actualizar la comunidad.");
    }
  };

  const crearHilo = async (e) => {
    e.preventDefault();

    if (!usuario) {
      pedirLogin();
      return;
    }

    if (!comunidadActiva) {
      mostrarAviso("No hay una comunidad disponible para publicar.");
      return;
    }

    const titulo = nuevoHilo.titulo.trim();
    const texto = nuevoHilo.texto.trim();
    if (!titulo || !texto) {
      mostrarAviso("Completa titulo y texto para publicar");
      return;
    }

    try {
      const hiloGuardado = normalizarHilo(
        await backendFetchJson(`/api/comunidades/${comunidadActivaId}/publicaciones`, {
          method: "POST",
          body: JSON.stringify({
            titulo,
            texto,
            tipo: nuevoHilo.tipo,
            etiqueta: nuevoHilo.etiqueta || comunidadActiva.genero,
          }),
        })
      );
      setHilos((actuales) => [hiloGuardado, ...actuales]);
      actualizarComunidad(comunidadActivaId, (comunidad) => {
        const publicaciones = Number(comunidad.publicaciones || 0) + 1;
        const miembros = comunidad.unido
          ? Number(comunidad.miembros || 0)
          : Number(comunidad.miembros || 0) + 1;
        return {
          ...comunidad,
          unido: true,
          miembros,
          publicaciones,
          actividad: `${publicaciones} publicaciones`,
        };
      });
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
      const dataLike = await backendFetchJson(`/api/comunidades/publicaciones/${id}/like`, {
        method: "POST",
      });
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
      const dataGuardado = await backendFetchJson(`/api/comunidades/publicaciones/${id}/guardar`, {
        method: "POST",
      });
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

  const votarComentario = async (hiloId, comentarioId) => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    const hilosAnteriores = hilos;
    actualizarHilo(hiloId, (hilo) => ({
      ...hilo,
      comentarios: actualizarComentario(hilo.comentarios, comentarioId, (comentario) => {
        const liked = !comentario.liked;
        const likes = Math.max(0, comentario.likes + (liked ? 1 : -1));
        return { ...comentario, liked, likes, votos: likes };
      }),
    }));

    try {
      const dataLike = await backendFetchJson(`/api/comunidades/comentarios/${comentarioId}/like`, {
        method: "POST",
      });
      actualizarHilo(hiloId, (hilo) => ({
        ...hilo,
        comentarios: actualizarComentario(hilo.comentarios, comentarioId, (comentario) => ({
          ...comentario,
          liked: dataLike.liked,
          likes: dataLike.likes,
          votos: dataLike.votos ?? dataLike.likes,
        })),
      }));
    } catch (error) {
      setHilos(hilosAnteriores);
      mostrarAviso(error.message || "No se pudo actualizar el me gusta.");
    }
  };

  const responder = async (hiloId, parentId = null) => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    const respuestaKey = parentId ? `${hiloId}:${parentId}` : String(hiloId);
    const texto = respuestas[respuestaKey]?.trim();
    if (!texto) return;

    try {
      const comentarioGuardado = await backendFetchJson(`/api/comunidades/publicaciones/${hiloId}/comentarios`, {
        method: "POST",
        body: JSON.stringify({ texto, parentId }),
      });
      const comentarioNormalizado = normalizarComentario(comentarioGuardado);
      setHilos((actuales) =>
        actuales.map((hilo) =>
          hilo.id === hiloId
            ? {
                ...hilo,
                comentarios: agregarComentario(hilo.comentarios, parentId, comentarioNormalizado),
                comentariosTotal: Number(hilo.comentariosTotal || hilo.comentarios.length) + 1,
              }
          : hilo
        )
      );
    } catch (error) {
      mostrarAviso(error.message || "No se pudo guardar el comentario.");
      return;
    }

    setRespuestas({ ...respuestas, [respuestaKey]: "" });
    if (parentId) setRespuestaActiva(null);
    setRespuestasAbiertas((abiertas) => abiertas.includes(hiloId) ? abiertas : [...abiertas, hiloId]);
  };

  const renderComentario = (hilo, comentario, nivel = 0) => {
    const respuestaKey = `${hilo.id}:${comentario.id}`;

    return (
      <article
        className={`respuesta-card ${nivel > 0 ? "respuesta-card-anidada" : ""}`}
        key={comentario.id}
      >
        <div className="respuesta-linea"></div>
        <div className="respuesta-cuerpo">
          <div className="respuesta-meta">
            <strong>{comentario.usuario}</strong>
            <span>{comentario.autor}</span>
            <span>{comentario.tiempo || "ahora"}</span>
          </div>
          <p><TextoConMenciones texto={comentario.texto} /></p>
          <div className="respuesta-acciones">
            <button
              className={comentario.liked ? "activo" : ""}
              type="button"
              onClick={() => votarComentario(hilo.id, comentario.id)}
            >
              {comentario.liked ? "Te gusta" : "Me gusta"} - {comentario.votos}
            </button>
            <button
              type="button"
              onClick={() => setRespuestaActiva(respuestaActiva === respuestaKey ? null : respuestaKey)}
            >
              Responder
            </button>
          </div>

          {respuestaActiva === respuestaKey ? (
            <div className="respuesta-form respuesta-form-anidada">
              <CampoMenciones
                placeholder={`Responder a ${comentario.usuario}`}
                value={respuestas[respuestaKey] || ""}
                onChange={(texto) => setRespuestas({ ...respuestas, [respuestaKey]: texto })}
              />
              <button type="button" onClick={() => responder(hilo.id, comentario.id)}>
                Responder
              </button>
            </div>
          ) : null}

          {(comentario.respuestas || []).map((respuesta) =>
            renderComentario(hilo, respuesta, nivel + 1)
          )}
        </div>
      </article>
    );
  };

  if (!comunidadActiva) {
    return (
      <main className="comunidad-container">
        <section className="comunidad-layout reddit-layout">
          <div className="comunidad-main">
            <div className="comunidad-vacio">
              {cargandoComunidades
                ? "Cargando comunidades..."
                : "No hay comunidades disponibles. Revisa la conexion con la base de datos."}
            </div>
          </div>
        </section>

        {aviso && (
          <div className="comunidad-toast" role="status">
            {aviso}
          </div>
        )}
      </main>
    );
  }

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
                    <span>{comunidad.miembros || 0} miembros</span>
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
                  <strong>{comunidadActiva.miembros || 0}</strong>
                  <span>miembros - {comunidadActiva.publicaciones || 0} publicaciones</span>
                </div>
              </div>
              <div className="comunidad-header-acciones">
                <button
                  className={`comunidad-unirse ${comunidadActiva.unido ? "activo" : ""}`}
                  type="button"
                  onClick={alternarUnion}
                >
                  {comunidadActiva.unido ? "Unido" : "Unirse"}
                </button>
                <button className="comunidad-crear" type="button" onClick={abrirCrearHilo}>
                  <span aria-hidden="true">+</span>
                  Crear publicacion
                </button>
              </div>
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
                      {hilo.comentariosTotal ?? hilo.comentarios.length} respuestas
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
                      {hilo.comentarios.map((comentario) => renderComentario(hilo, comentario))}

                      <div className="respuesta-form">
                        <CampoMenciones
                          placeholder="Respondé o mencioná con @usuario"
                          value={respuestas[String(hilo.id)] || ""}
                          onChange={(texto) => setRespuestas({ ...respuestas, [String(hilo.id)]: texto })}
                        />
                        <button type="button" onClick={() => responder(hilo.id)}>
                          Responder
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
              <strong>{comunidadActiva.miembros || 0}</strong>
              <span>miembros</span>
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
                <button type="submit">Publicar</button>
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
