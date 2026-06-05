import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./descubrir.css";

const lanzamientosIniciales = [
  {
    id: 1,
    artista: "Luna Norte",
    usuario: "@lunanorte",
    oyentes: "12.8K",
    tema: "Ruido de ciudad",
    album: "Neon de madrugada",
    descripcion: "Sintetizadores brillantes, bajo suave y una voz bien cerca para arrancar la noche.",
    duracion: "3:42",
    progreso: 34,
    likes: "27.2K",
    comentarios: "107",
    compartidos: "1,177",
    colorA: "#ffae00",
    colorB: "#ff5e00",
    colorC: "#1b1b1b",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 2,
    artista: "Santo Beat",
    usuario: "@santobeat",
    oyentes: "8.7K",
    tema: "Pulso lento",
    album: "Sala roja",
    descripcion: "Trap, soul y percusiones latinas en una demo cruda con energia de vivo.",
    duracion: "2:58",
    progreso: 51,
    likes: "18.4K",
    comentarios: "89",
    compartidos: "640",
    colorA: "#3cff00",
    colorB: "#023b22",
    colorC: "#111111",
    liked: true,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 3,
    artista: "Marea Gris",
    usuario: "@mareagris",
    oyentes: "21.4K",
    tema: "Antes del final",
    album: "Paredes de humo",
    descripcion: "Rock alternativo con guitarras densas, bateria seca y un estribillo directo.",
    duracion: "4:11",
    progreso: 22,
    likes: "31.9K",
    comentarios: "214",
    compartidos: "2,031",
    colorA: "#aa3bff",
    colorB: "#3157ff",
    colorC: "#070707",
    liked: false,
    guardado: true,
    siguiendo: true,
  },
  {
    id: 4,
    artista: "Nico Solar",
    usuario: "@nicosolar",
    oyentes: "5.4K",
    tema: "Cables",
    album: "Habitacion 404",
    descripcion: "Bedroom pop con guitarras limpias, coros luminosos y ruido de cinta.",
    duracion: "3:16",
    progreso: 68,
    likes: "9.6K",
    comentarios: "42",
    compartidos: "318",
    colorA: "#00d4ff",
    colorB: "#f3f6ff",
    colorC: "#13223a",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 5,
    artista: "Valle Club",
    usuario: "@valleclub",
    oyentes: "16.3K",
    tema: "Otra vuelta",
    album: "Club del valle",
    descripcion: "Funk alternativo con groove marcado, bajos vivos y textura de sala chica.",
    duracion: "3:29",
    progreso: 45,
    likes: "22.1K",
    comentarios: "133",
    compartidos: "924",
    colorA: "#ff5e00",
    colorB: "#ffd86b",
    colorC: "#15100b",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
];

const iconos = {
  play: "M320-200v-560l440 280-440 280Z",
  pausa: "M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z",
  corazon:
    "m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z",
  comentario:
    "M240-400h480v-80H240v80Zm0-120h480v-80H240v80Zm0-120h480v-80H240v80ZM80-80v-720q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240L80-80Z",
  compartir:
    "M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38.5 23.5T240-360q-50 0-85-35t-35-85q0-50 35-85t85-35q22 0 43.5 8.5T322-568l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-22 0-43.5-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38.5-23.5T720-320q50 0 85 35t35 85q0 50-35 85t-85 35Z",
  guardar: "M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Z",
  subir: "m280-400 200-200 200 200H280Z",
  bajar: "M480-360 280-560h400L480-360Z",
  enviar: "M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Z",
  cerrar: "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
};

const comentariosIniciales = [
  {
    id: 1,
    usuario: "@abrilsonica",
    tiempo: "hace 12 min",
    texto: "Este sonido pide escenario chico y luces bajas.",
    likes: 1200,
    liked: false,
    respuestas: [
      {
        id: 11,
        usuario: "@lunanorte",
        tiempo: "hace 8 min",
        texto: "Totalmente, ese era el clima que buscabamos.",
        likes: 84,
        liked: false,
      },
    ],
  },
  {
    id: 2,
    usuario: "@matibeat",
    tiempo: "hace 34 min",
    texto: "El bajo entra hermoso, guardadisimo.",
    likes: 864,
    liked: false,
    respuestas: [],
  },
  {
    id: 3,
    usuario: "@valenruido",
    tiempo: "hace 1 hora",
    texto: "Necesito escuchar la version completa.",
    likes: 512,
    liked: false,
    respuestas: [
      {
        id: 31,
        usuario: "@clubdemo",
        tiempo: "hace 42 min",
        texto: "Sale el viernes, ya lo dijeron en historias.",
        likes: 37,
        liked: false,
      },
      {
        id: 32,
        usuario: "@abrilsonica",
        tiempo: "hace 28 min",
        texto: "Va directo a mi playlist nocturna.",
        likes: 21,
        liked: false,
      },
    ],
  },
  {
    id: 4,
    usuario: "@clubdemo",
    tiempo: "hace 2 horas",
    texto: "Esto va perfecto para abrir una playlist nocturna.",
    likes: 306,
    liked: false,
    respuestas: [],
  },
];

function Icono({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="28" height="28" fill="currentColor">
      <path d={iconos[nombre]} />
    </svg>
  );
}

function duracionASegundos(duracion) {
  const [minutos, segundos] = duracion.split(":").map(Number);
  return minutos * 60 + segundos;
}

function formatearConteo(numero) {
  if (numero >= 1000) {
    const valor = numero / 1000;
    return `${Number.isInteger(valor) ? valor : valor.toFixed(1)}K`;
  }

  return String(numero);
}

function obtenerUsuarioActual(usuario) {
  if (usuario?.email) return `@${usuario.email.split("@")[0]}`;
  if (usuario?.displayName) return `@${usuario.displayName.toLowerCase().replaceAll(" ", "_")}`;
  return "@seguidor";
}

export default function Descubrir({ usuario }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lanzamientos, setLanzamientos] = useState(lanzamientosIniciales);
  const [reproduciendo, setReproduciendo] = useState(lanzamientosIniciales[0].id);
  const [comentariosAbiertos, setComentariosAbiertos] = useState(null);
  const [comentariosAnimando, setComentariosAnimando] = useState(false);
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [comentarios, setComentarios] = useState(comentariosIniciales);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([]);
  const [respuestaActiva, setRespuestaActiva] = useState(null);
  const [respuestaTexto, setRespuestaTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [progresos, setProgresos] = useState(() =>
    Object.fromEntries(lanzamientosIniciales.map((lanzamiento) => [lanzamiento.id, 0]))
  );
  const reproduciendoRef = useRef(reproduciendo);
  const comentariosAbiertosRef = useRef(comentariosAbiertos);
  const lanzamientosFiltradosRef = useRef([]);
  const ruedaAcumuladaRef = useRef(0);
  const ultimoMovimientoRuedaRef = useRef(0);
  const toqueInicioRef = useRef(null);
  const avisoTimer = useRef(null);
  const comentariosAnimacionTimer = useRef(null);
  const query = searchParams.get("query")?.trim().toLowerCase() || "";

  const lanzamientosFiltrados = useMemo(() => {
    if (!query) return lanzamientos;

    return lanzamientos.filter((lanzamiento) => {
      const contenido =
        `${lanzamiento.artista} ${lanzamiento.usuario} ${lanzamiento.tema} ${lanzamiento.album} ${lanzamiento.descripcion}`.toLowerCase();
      return contenido.includes(query);
    });
  }, [lanzamientos, query]);

  useEffect(() => {
    reproduciendoRef.current = reproduciendo;
  }, [reproduciendo]);

  useEffect(() => {
    comentariosAbiertosRef.current = comentariosAbiertos;
  }, [comentariosAbiertos]);

  useEffect(() => {
    lanzamientosFiltradosRef.current = lanzamientosFiltrados;
  }, [lanzamientosFiltrados]);

  useEffect(() => {
    return () => {
      clearTimeout(avisoTimer.current);
      clearTimeout(comentariosAnimacionTimer.current);
    };
  }, []);

  useEffect(() => {
    const pista = document.querySelector(".feed-pista");
    if (!pista) return undefined;

    const observer = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const id = Number(visible.target.getAttribute("data-reel-id"));
        if (!id || reproduciendoRef.current === id) return;

        reproduciendoRef.current = id;
        setReproduciendo(id);
        if (comentariosAbiertosRef.current !== null) {
          setComentariosAnimando(false);
          clearTimeout(comentariosAnimacionTimer.current);
          comentariosAbiertosRef.current = id;
          setComentariosAbiertos(id);
        }
        setProgresos((prev) => ({ ...prev, [id]: 0 }));
      },
      {
        root: pista,
        threshold: [0.58, 0.72, 0.9],
      }
    );

    lanzamientosFiltrados.forEach((lanzamiento) => {
      const reel = document.getElementById(`reel-${lanzamiento.id}`);
      if (reel) observer.observe(reel);
    });

    return () => observer.disconnect();
  }, [lanzamientosFiltrados]);

  useEffect(() => {
    const pista = document.querySelector(".feed-pista");
    if (!pista) return undefined;

    const obtenerPanelComentarios = (elemento) =>
      elemento.closest?.(".comentarios-panel.abierto") || null;

    const puedeScrollearPanel = (elemento, deltaY) => {
      const panel = obtenerPanelComentarios(elemento);
      if (!panel) return false;

      const areaScrollable = elemento.closest?.(".comentarios-lista") || panel;
      const { scrollTop, scrollHeight, clientHeight } = areaScrollable;
      const margen = 2;
      const puedeSubir = scrollTop > margen;
      const puedeBajar = scrollTop + clientHeight < scrollHeight - margen;

      return deltaY < 0 ? puedeSubir : puedeBajar;
    };

    const manejarRueda = (event) => {
      if (obtenerPanelComentarios(event.target)) {
        if (!puedeScrollearPanel(event.target, event.deltaY)) {
          event.preventDefault();
        }
        ruedaAcumuladaRef.current = 0;
        return;
      }

      ruedaAcumuladaRef.current += event.deltaY;
      const ahora = performance.now();
      const intensidad = Math.abs(ruedaAcumuladaRef.current);

      if (intensidad < 54 || ahora - ultimoMovimientoRuedaRef.current < 420) return;

      const direccion = ruedaAcumuladaRef.current > 0 ? "abajo" : "arriba";
      const idActual = reproduciendoRef.current ?? lanzamientosFiltradosRef.current[0]?.id;
      const seMovio = desplazarReel(idActual, direccion);

      if (seMovio) {
        event.preventDefault();
        ultimoMovimientoRuedaRef.current = ahora;
      }

      ruedaAcumuladaRef.current = 0;
    };

    const manejarToqueInicio = (event) => {
      if (obtenerPanelComentarios(event.target)) {
        toqueInicioRef.current = null;
        return;
      }

      const toque = event.touches[0];
      toqueInicioRef.current = {
        x: toque.clientX,
        y: toque.clientY,
      };
    };

    const manejarToqueFin = (event) => {
      if (!toqueInicioRef.current || event.changedTouches.length === 0) return;

      const toque = event.changedTouches[0];
      const deltaX = toque.clientX - toqueInicioRef.current.x;
      const deltaY = toque.clientY - toqueInicioRef.current.y;
      const distanciaVertical = Math.abs(deltaY);
      const ahora = performance.now();

      toqueInicioRef.current = null;

      if (
        distanciaVertical < 58 ||
        Math.abs(deltaX) > distanciaVertical * 0.72 ||
        ahora - ultimoMovimientoRuedaRef.current < 360
      ) {
        return;
      }

      const direccion = deltaY < 0 ? "abajo" : "arriba";
      const idActual = reproduciendoRef.current ?? lanzamientosFiltradosRef.current[0]?.id;
      const seMovio = desplazarReel(idActual, direccion);

      if (seMovio) {
        ultimoMovimientoRuedaRef.current = ahora;
      }
    };

    pista.addEventListener("wheel", manejarRueda, { passive: false });
    pista.addEventListener("touchstart", manejarToqueInicio, { passive: true });
    pista.addEventListener("touchend", manejarToqueFin, { passive: true });

    return () => {
      pista.removeEventListener("wheel", manejarRueda);
      pista.removeEventListener("touchstart", manejarToqueInicio);
      pista.removeEventListener("touchend", manejarToqueFin);
    };
  }, []);

  useEffect(() => {
    if (reproduciendo === null) return undefined;

    const lanzamientoActual = lanzamientos.find((lanzamiento) => lanzamiento.id === reproduciendo);
    if (!lanzamientoActual) return undefined;

    const intervaloMs = 250;
    const paso = 100 / (duracionASegundos(lanzamientoActual.duracion) * (1000 / intervaloMs));

    const intervalo = window.setInterval(() => {
      setProgresos((prev) => {
        const actual = prev[reproduciendo] ?? 0;
        const siguiente = actual + paso;
        return {
          ...prev,
          [reproduciendo]: siguiente >= 100 ? 0 : siguiente,
        };
      });
    }, intervaloMs);

    return () => window.clearInterval(intervalo);
  }, [lanzamientos, reproduciendo]);

  const mostrarAviso = (mensaje) => {
    clearTimeout(avisoTimer.current);
    setAviso(mensaje);
    avisoTimer.current = setTimeout(() => {
      setAviso("");
    }, 2400);
  };

  const pedirLogin = () => {
    mostrarAviso("Tenes que iniciar sesion para interactuar en Descubrir");
  };

  const ejecutarConSesion = (accion) => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    accion();
  };

  const actualizarLanzamiento = (id, campo) => {
    setLanzamientos((prev) =>
      prev.map((lanzamiento) =>
        lanzamiento.id === id
          ? { ...lanzamiento, [campo]: !lanzamiento[campo] }
          : lanzamiento
      )
    );
  };

  const abrirArtista = (lanzamiento) => {
    const slug = lanzamiento.artista.toLowerCase().replaceAll(" ", "-");
    navigate(`/otro-perfil?artista=${slug}`, { state: { artista: lanzamiento } });
  };

  const alternarReproduccion = (id) => {
    setReproduciendo((actual) => (actual === id ? null : id));
  };

  const cambiarComentariosConAnimacion = (siguiente) => {
    clearTimeout(comentariosAnimacionTimer.current);
    setComentariosAnimando(true);
    setComentariosAbiertos(siguiente);
    comentariosAbiertosRef.current = siguiente;
    comentariosAnimacionTimer.current = setTimeout(() => {
      setComentariosAnimando(false);
    }, 360);
  };

  function desplazarReel(id, direccion) {
    const actual = document.getElementById(`reel-${id}`);
    const destino =
      direccion === "arriba"
        ? actual?.previousElementSibling
        : actual?.nextElementSibling;

    if (!destino) return false;

    destino.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  const moverReel = (id, direccion) => {
    desplazarReel(id, direccion);
  };

  const enviarComentario = (event) => {
    event.preventDefault();
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = comentarioTexto.trim();

    if (!texto) return;

    setComentarios((prev) => [
      {
        id: Date.now(),
        usuario: obtenerUsuarioActual(usuario),
        tiempo: "ahora",
        texto,
        likes: 0,
        liked: false,
        respuestas: [],
      },
      ...prev,
    ]);
    setComentarioTexto("");
  };

  const toggleLikeComentario = (comentarioId, respuestaId = null) => {
    ejecutarConSesion(() => {
      setComentarios((prev) =>
        prev.map((comentario) => {
          if (comentario.id !== comentarioId) return comentario;

          if (respuestaId !== null) {
            return {
              ...comentario,
              respuestas: comentario.respuestas.map((respuesta) =>
                respuesta.id === respuestaId
                  ? {
                      ...respuesta,
                      liked: !respuesta.liked,
                      likes: respuesta.liked ? respuesta.likes - 1 : respuesta.likes + 1,
                    }
                  : respuesta
              ),
            };
          }

          return {
            ...comentario,
            liked: !comentario.liked,
            likes: comentario.liked ? comentario.likes - 1 : comentario.likes + 1,
          };
        })
      );
    });
  };

  const abrirRespuesta = (comentarioId) => {
    ejecutarConSesion(() => {
      setRespuestaActiva((actual) => (actual === comentarioId ? null : comentarioId));
      setRespuestaTexto("");
    });
  };

  const toggleRespuestas = (comentarioId) => {
    setRespuestasAbiertas((abiertas) =>
      abiertas.includes(comentarioId)
        ? abiertas.filter((id) => id !== comentarioId)
        : [...abiertas, comentarioId]
    );
  };

  const enviarRespuesta = (event, comentarioId) => {
    event.preventDefault();
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = respuestaTexto.trim();
    if (!texto) return;

    setComentarios((prev) =>
      prev.map((comentario) =>
        comentario.id === comentarioId
          ? {
              ...comentario,
              respuestas: [
                ...comentario.respuestas,
                {
                  id: Date.now(),
                  usuario: obtenerUsuarioActual(usuario),
                  tiempo: "ahora",
                  texto,
                  likes: 0,
                  liked: false,
                },
              ],
            }
          : comentario
      )
    );
    setRespuestaTexto("");
    setRespuestaActiva(null);
    setRespuestasAbiertas((abiertas) =>
      abiertas.includes(comentarioId) ? abiertas : [...abiertas, comentarioId]
    );
  };

  return (
    <section
      className={`descubrir-feed ${comentariosAbiertos !== null ? "comentarios-globales" : ""} ${
        comentariosAnimando ? "comentarios-animando" : ""
      }`}
      aria-label="Descubrir musica"
    >
      <div className="feed-pista">
        {lanzamientosFiltrados.map((lanzamiento) => {
          const estaReproduciendo = reproduciendo === lanzamiento.id;

          return (
            <article
              id={`reel-${lanzamiento.id}`}
              data-reel-id={lanzamiento.id}
              className={`feed-item ${estaReproduciendo ? "sonando" : ""} ${
                comentariosAbiertos === lanzamiento.id ? "comentarios-activos" : ""
              }`}
              key={lanzamiento.id}
              style={{
                "--tono-a": lanzamiento.colorA,
                "--tono-b": lanzamiento.colorB,
                "--tono-c": lanzamiento.colorC,
                "--progreso": `${progresos[lanzamiento.id] ?? lanzamiento.progreso}%`,
              }}
            >
              <div className="album-centro">
                <div
                  className={`album-portada ${lanzamiento.portada ? "con-imagen" : ""}`}
                  onClick={() => alternarReproduccion(lanzamiento.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      alternarReproduccion(lanzamiento.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${estaReproduciendo ? "Pausar" : "Reproducir"} ${lanzamiento.tema}`}
                >
                  {lanzamiento.portada ? (
                    <img
                      className="album-imagen"
                      src={lanzamiento.portada}
                      alt=""
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="album-sello">SONDAR</span>
                  <span className="album-brillo" />
                  <span className="album-disco" />
                  <span className="estado-reproduccion" aria-hidden="true">
                    <Icono nombre="play" />
                  </span>
                  <span className="album-titulo">{lanzamiento.album}</span>
                  <span className="album-artista">{lanzamiento.artista}</span>
                  <div
                    className="album-meta"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      className="artista-avatar"
                      type="button"
                      onClick={() => abrirArtista(lanzamiento)}
                      aria-label={`Ver perfil de ${lanzamiento.artista}`}
                    >
                      {lanzamiento.artista.charAt(0)}
                    </button>
                    <div className="album-copy">
                      <div className="album-linea">
                        <button
                          className="artista-nombre"
                          type="button"
                          onClick={() => abrirArtista(lanzamiento)}
                        >
                          {lanzamiento.usuario}
                        </button>
                        <button
                          className={`seguir-btn ${lanzamiento.siguiendo ? "activo" : ""}`}
                          type="button"
                          onClick={() =>
                            ejecutarConSesion(() => actualizarLanzamiento(lanzamiento.id, "siguiendo"))
                          }
                        >
                          {lanzamiento.siguiendo ? "Siguiendo" : "Seguir"}
                        </button>
                      </div>
                      <p>{lanzamiento.descripcion}</p>
                    </div>
                  </div>
                </div>
                <input
                  className="reel-progress"
                  type="range"
                  min="0"
                  max="100"
                  value={progresos[lanzamiento.id] ?? lanzamiento.progreso}
                  aria-label={`Avanzar o retroceder ${lanzamiento.tema}`}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setProgresos((prev) => ({
                      ...prev,
                      [lanzamiento.id]: Number(event.target.value),
                    }))
                  }
                />
              </div>

              <div className="acciones-verticales" aria-label={`Acciones de ${lanzamiento.tema}`}>
                <div className="accion-item">
                  <button
                    className={`accion-boton ${lanzamiento.liked ? "activo" : ""}`}
                    type="button"
                    aria-label={lanzamiento.liked ? "Quitar me gusta" : "Me gusta"}
                    onClick={() =>
                      ejecutarConSesion(() => actualizarLanzamiento(lanzamiento.id, "liked"))
                    }
                  >
                    <Icono nombre="corazon" />
                  </button>
                  <span>{lanzamiento.likes}</span>
                </div>
                <div className="accion-item">
                  <button
                    className={`accion-boton ${comentariosAbiertos === lanzamiento.id ? "activo" : ""}`}
                    type="button"
                    aria-label="Comentar"
                    onClick={() =>
                      cambiarComentariosConAnimacion(
                        comentariosAbiertos === lanzamiento.id ? null : lanzamiento.id
                      )
                    }
                  >
                    <Icono nombre="comentario" />
                  </button>
                  <span>{lanzamiento.comentarios}</span>
                </div>
                <div className="accion-item">
                  <button
                    className="accion-boton"
                    type="button"
                    aria-label="Compartir"
                    onClick={() => ejecutarConSesion(() => mostrarAviso("Link copiado para compartir"))}
                  >
                    <Icono nombre="compartir" />
                  </button>
                  <span>{lanzamiento.compartidos}</span>
                </div>
                <div className="accion-item">
                  <button
                    className={`accion-boton ${lanzamiento.guardado ? "activo" : ""}`}
                    type="button"
                    aria-label={lanzamiento.guardado ? "Quitar de guardados" : "Guardar"}
                    onClick={() =>
                      ejecutarConSesion(() => actualizarLanzamiento(lanzamiento.id, "guardado"))
                    }
                  >
                    <Icono nombre="guardar" />
                  </button>
                </div>
              </div>

              <aside
                className={`comentarios-panel ${
                  comentariosAbiertos === lanzamiento.id ? "abierto" : ""
                }`}
                aria-hidden={comentariosAbiertos !== lanzamiento.id}
              >
                <header className="comentarios-header">
                  <strong>Comentarios</strong>
                  <span>{lanzamiento.comentarios}</span>
                  <button
                    type="button"
                    aria-label="Cerrar comentarios"
                    onClick={() => cambiarComentariosConAnimacion(null)}
                  >
                    <Icono nombre="cerrar" />
                  </button>
                </header>
                <div className="comentarios-lista">
                  {comentarios.map((comentario) => (
                    <article className="comentario" key={comentario.id}>
                      <div className="comentario-avatar">
                        {comentario.usuario.charAt(1).toUpperCase()}
                      </div>
                      <div>
                        <strong>
                          {comentario.usuario} <span>{comentario.tiempo}</span>
                        </strong>
                        <p>{comentario.texto}</p>
                        <div className="comentario-acciones">
                          <button type="button" onClick={() => abrirRespuesta(comentario.id)}>
                            Responder
                          </button>
                          <small>{formatearConteo(comentario.likes)} me gusta</small>
                        </div>
                        {comentario.respuestas.length > 0 ? (
                          <button
                            className="comentario-ver-respuestas"
                            type="button"
                            onClick={() => toggleRespuestas(comentario.id)}
                          >
                            {respuestasAbiertas.includes(comentario.id)
                              ? "Ocultar respuestas"
                              : `Ver ${comentario.respuestas.length} respuestas`}
                          </button>
                        ) : null}
                        {respuestasAbiertas.includes(comentario.id) ? (
                          <div className="comentario-respuestas">
                            {comentario.respuestas.map((respuesta) => (
                              <article className="comentario comentario-respuesta" key={respuesta.id}>
                                <div className="comentario-avatar">
                                  {respuesta.usuario.charAt(1).toUpperCase()}
                                </div>
                                <div>
                                  <strong>
                                    {respuesta.usuario} <span>{respuesta.tiempo}</span>
                                  </strong>
                                  <p>{respuesta.texto}</p>
                                  <div className="comentario-acciones">
                                    <button type="button" onClick={() => abrirRespuesta(comentario.id)}>
                                      Responder
                                    </button>
                                    <small>{formatearConteo(respuesta.likes)} me gusta</small>
                                  </div>
                                </div>
                                <button
                                  className={`comentario-like ${respuesta.liked ? "activo" : ""}`}
                                  type="button"
                                  aria-label={respuesta.liked ? "Quitar me gusta" : "Me gusta"}
                                  onClick={() => toggleLikeComentario(comentario.id, respuesta.id)}
                                >
                                  <Icono nombre="corazon" />
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : null}
                        {respuestaActiva === comentario.id ? (
                          <form className="respuesta-comentario-form" onSubmit={(event) => enviarRespuesta(event, comentario.id)}>
                            <input
                              type="text"
                              placeholder={`Responder a ${comentario.usuario}`}
                              value={respuestaTexto}
                              onChange={(event) => setRespuestaTexto(event.target.value)}
                              autoFocus
                            />
                            <button type="submit">Enviar</button>
                          </form>
                        ) : null}
                      </div>
                      <button
                        className={`comentario-like ${comentario.liked ? "activo" : ""}`}
                        type="button"
                        aria-label={comentario.liked ? "Quitar me gusta" : "Me gusta"}
                        onClick={() => toggleLikeComentario(comentario.id)}
                      >
                        <Icono nombre="corazon" />
                      </button>
                    </article>
                  ))}
                </div>
                <form className="comentario-form" onSubmit={enviarComentario}>
                  <div className="comentario-avatar">T</div>
                  <input
                    type="text"
                    placeholder="Agrega un comentario..."
                    value={comentarioTexto}
                    onChange={(event) => setComentarioTexto(event.target.value)}
                  />
                  <button type="submit" aria-label="Enviar comentario">
                    <Icono nombre="enviar" />
                  </button>
                </form>
              </aside>

              <nav className="reel-nav" aria-label="Navegar reels">
                <button
                  type="button"
                  aria-label="Reel anterior"
                  onClick={() => moverReel(lanzamiento.id, "arriba")}
                  disabled={lanzamientosFiltrados[0]?.id === lanzamiento.id}
                >
                  <Icono nombre="subir" />
                </button>
                <button
                  type="button"
                  aria-label="Siguiente reel"
                  onClick={() => moverReel(lanzamiento.id, "abajo")}
                  disabled={lanzamientosFiltrados[lanzamientosFiltrados.length - 1]?.id === lanzamiento.id}
                >
                  <Icono nombre="bajar" />
                </button>
              </nav>

            </article>
          );
        })}
      </div>

      {lanzamientosFiltrados.length === 0 ? (
        <p className="descubrir-vacio">No encontramos musica para esa busqueda.</p>
      ) : null}
      {aviso ? (
        <div className="descubrir-toast" role="status">
          {aviso}
        </div>
      ) : null}
    </section>
  );
}
