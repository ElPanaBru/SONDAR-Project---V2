import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
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
    likes: 27200,
    comentarios: "107",
    compartidos: 1177,
    guardados: 2840,
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
    likes: 18400,
    comentarios: "89",
    compartidos: 640,
    guardados: 1960,
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
    likes: 31900,
    comentarios: "214",
    compartidos: 2031,
    guardados: 4210,
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
    likes: 9600,
    comentarios: "42",
    compartidos: 318,
    guardados: 875,
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
    likes: 22100,
    comentarios: "133",
    compartidos: 924,
    guardados: 2310,
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
  mas: "M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z",
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

const comentariosPorLanzamientoIniciales = {
  1: comentariosIniciales,
  2: [
    {
      id: 201,
      usuario: "@beatcurioso",
      tiempo: "hace 9 min",
      texto: "La percusion de esta demo tiene un groove tremendo.",
      likes: 430,
      liked: false,
      respuestas: [
        {
          id: 2011,
          usuario: "@santobeat",
          tiempo: "hace 4 min",
          texto: "Gracias, la arme con samples grabados en sala.",
          likes: 39,
          liked: false,
        },
      ],
    },
    {
      id: 202,
      usuario: "@noche808",
      tiempo: "hace 27 min",
      texto: "El bajo pide volumen alto. Esto en vivo puede explotar.",
      likes: 290,
      liked: false,
      respuestas: [],
    },
  ],
  3: [
    {
      id: 301,
      usuario: "@guitarraruido",
      tiempo: "hace 18 min",
      texto: "Las guitarras tienen una pared hermosa, muy bien mezcladas.",
      likes: 980,
      liked: false,
      respuestas: [],
    },
    {
      id: 302,
      usuario: "@alternativo_sur",
      tiempo: "hace 46 min",
      texto: "El estribillo entra directo, tiene olor a cierre de show.",
      likes: 604,
      liked: false,
      respuestas: [
        {
          id: 3021,
          usuario: "@mareagris",
          tiempo: "hace 30 min",
          texto: "Esa era la idea: que el final levante todo.",
          likes: 71,
          liked: false,
        },
      ],
    },
  ],
  4: [
    {
      id: 401,
      usuario: "@habitacionpop",
      tiempo: "hace 7 min",
      texto: "El ruido de cinta queda perfecto con esas guitarras limpias.",
      likes: 220,
      liked: false,
      respuestas: [],
    },
    {
      id: 402,
      usuario: "@solarclub",
      tiempo: "hace 39 min",
      texto: "Muy linda la melodia del puente. Se queda dando vueltas.",
      likes: 188,
      liked: false,
      respuestas: [],
    },
  ],
  5: [
    {
      id: 501,
      usuario: "@bajofunk",
      tiempo: "hace 15 min",
      texto: "Ese bajo esta adelante como corresponde. Tremendo pulso.",
      likes: 510,
      liked: false,
      respuestas: [],
    },
    {
      id: 502,
      usuario: "@vallefan",
      tiempo: "hace 1 hora",
      texto: "Me encanta que suene a sala chica, tiene mucha presencia.",
      likes: 344,
      liked: false,
      respuestas: [
        {
          id: 5021,
          usuario: "@valleclub",
          tiempo: "hace 42 min",
          texto: "Lo grabamos casi todo tocando juntos.",
          likes: 55,
          liked: false,
        },
      ],
    },
  ],
};

const GENEROS_REEL = [
  "pop",
  "rock",
  "edm",
  "jazz",
  "blues",
  "cumbia",
  "trap",
  "metal",
  "folklore",
  "otros",
];

function mostrarGeneroReel(genero) {
  if (!genero) return "";
  return genero === "edm" ? "EDM" : genero.charAt(0).toUpperCase() + genero.slice(1);
}

function Icono({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="28" height="28" fill="currentColor">
      <path d={iconos[nombre]} />
    </svg>
  );
}

function IconoPersona() {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="22" height="22" fill="currentColor">
      <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-204q-59 0-99.5-40.5T340-620q0-59 40.5-99.5T480-760q59 0 99.5 40.5T620-620q0 59-40.5 99.5T480-480Zm0 400q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
    </svg>
  );
}

function duracionASegundos(duracion) {
  const [minutos, segundos] = duracion.split(":").map(Number);
  return minutos * 60 + segundos;
}

function formatearConteo(numero) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

function obtenerUsuarioActual(usuario) {
  if (usuario?.email) return `@${usuario.email.split("@")[0]}`;
  if (usuario?.displayName) return `@${usuario.displayName.toLowerCase().replaceAll(" ", "_")}`;
  return "@seguidor";
}

function obtenerClaveUsuario(usuario) {
  return usuario?.id || usuario?.email || usuario?.displayName || "invitado";
}

function inicialComentario(comentario) {
  return comentario?.usuario?.replace(/^@/, "").charAt(0).toUpperCase() || "S";
}

function AvatarComentario({ comentario }) {
  if (comentario?.avatar) {
    return <img src={comentario.avatar} alt="" />;
  }

  return inicialComentario(comentario);
}

function buscarAvatarEnComentarios(comentarios, userId) {
  for (const comentario of comentarios || []) {
    if (comentario.userId === userId && comentario.avatar) return comentario.avatar;

    const avatarRespuesta = buscarAvatarEnComentarios(comentario.respuestas, userId);
    if (avatarRespuesta) return avatarRespuesta;
  }

  return "";
}

const reelVacio = {
  tema: "",
  album: "",
  genero: "",
  descripcion: "",
  portada: "",
  portadaFile: null,
  audio: "",
  audioFile: null,
  nombrePortada: "",
  nombreAudio: "",
  duracion: "0:30",
};

export default function Descubrir({ usuario }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const lanzamientoCompartido = searchParams.get("lanzamiento");
  const crearReelParam = searchParams.get("crear");
  const [lanzamientos, setLanzamientos] = useState([]);
  const [reproduciendo, setReproduciendo] = useState(lanzamientoCompartido || null);
  const [comentariosAbiertos, setComentariosAbiertos] = useState(null);
  const [comentariosAnimando, setComentariosAnimando] = useState(false);
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [comentariosPorLanzamiento, setComentariosPorLanzamiento] = useState({});
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([]);
  const [respuestaActiva, setRespuestaActiva] = useState(null);
  const [respuestaPara, setRespuestaPara] = useState(null);
  const [respuestaTexto, setRespuestaTexto] = useState("");
  const [aviso, setAviso] = useState("");
  const [animacionesLike, setAnimacionesLike] = useState({});
  const [mostrarCrearReel, setMostrarCrearReel] = useState(false);
  const [nuevoReel, setNuevoReel] = useState(reelVacio);
  const [menuLanzamientoAbierto, setMenuLanzamientoAbierto] = useState(null);
  const [progresos, setProgresos] = useState({});
  const reproduciendoRef = useRef(reproduciendo);
  const comentariosAbiertosRef = useRef(comentariosAbiertos);
  const lanzamientosFiltradosRef = useRef([]);
  const ruedaAcumuladaRef = useRef(0);
  const ultimoMovimientoRuedaRef = useRef(0);
  const toqueInicioRef = useRef(null);
  const avisoTimer = useRef(null);
  const comentariosAnimacionTimer = useRef(null);
  const audioReelRef = useRef(null);
  const audioReelActivoIdRef = useRef(null);
  const tiemposReelRef = useRef({});
  const reelPausadoPorUsuarioRef = useRef(null);
  const portadaReelInputRef = useRef(null);
  const audioReelInputRef = useRef(null);
  const query = searchParams.get("query")?.trim().toLowerCase() || "";
  const usuarioComentario = obtenerUsuarioActual(usuario);
  const claveUsuarioActual = obtenerClaveUsuario(usuario);
  const inicialUsuario = usuario ? usuarioComentario.charAt(1).toUpperCase() : "";
  const audioReproduciendo = lanzamientos.find(
    (lanzamiento) => lanzamiento.id === reproduciendo
  )?.audio;

  const lanzamientosFiltrados = useMemo(() => {
    if (!query) return lanzamientos;

    return lanzamientos.filter((lanzamiento) => {
      const contenido =
        `${lanzamiento.artista} ${lanzamiento.usuario} ${lanzamiento.tema} ${lanzamiento.album} ${lanzamiento.descripcion}`.toLowerCase();
      return contenido.includes(query);
    });
  }, [lanzamientos, query]);
  const idsLanzamientosFiltrados = lanzamientosFiltrados
    .map((lanzamiento) => lanzamiento.id)
    .join(",");

  const guardarTiempoAudioActual = () => {
    const audio = audioReelRef.current;
    const id = audioReelActivoIdRef.current;

    if (audio && id !== null && Number.isFinite(audio.currentTime)) {
      tiemposReelRef.current[id] = audio.currentTime;
    }
  };

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
    if (!lanzamientoCompartido) return;

    const destino = document.getElementById(`reel-${lanzamientoCompartido}`);
    if (!destino) return;

    destino.scrollIntoView({ block: "start" });
  }, [lanzamientoCompartido, idsLanzamientosFiltrados]);

  useEffect(() => {
    return () => {
      clearTimeout(avisoTimer.current);
      clearTimeout(comentariosAnimacionTimer.current);
    };
  }, []);

  useEffect(() => {
    const abrirCreador = () => ejecutarConSesion(() => setMostrarCrearReel(true));
    window.addEventListener("sondar:crear-reel", abrirCreador);
    return () => window.removeEventListener("sondar:crear-reel", abrirCreador);
  });

  useEffect(() => {
    if (crearReelParam !== "reel") return;
    ejecutarConSesion(() => setMostrarCrearReel(true));
  }, [crearReelParam, usuario]);

  useEffect(() => {
    let activo = true;

    const cargarReels = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const response = await fetch(apiUrl("/api/reels"), {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
        });
        if (!response.ok) throw new Error("No se pudieron cargar los reels.");

        const data = await response.json();
        const reelsBackend = data.map((reel) => ({
          ...reel,
          id: `db-${reel.id}`,
          backendId: reel.backendId || reel.id,
        }));

        if (activo) {
          setLanzamientos(reelsBackend);
          const comentariosEntries = await Promise.all(
            reelsBackend.map(async (reel) => {
              try {
                const comentariosResponse = await fetch(apiUrl(`/api/reels/${reel.backendId}/comentarios`));
                if (!comentariosResponse.ok) return [reel.id, []];
                const comentarios = await comentariosResponse.json();
                return [reel.id, comentarios];
              } catch {
                return [reel.id, []];
              }
            })
          );

          const comentariosPorReel = Object.fromEntries(comentariosEntries);
          let reelsConAvatar = reelsBackend.map((reel) => ({
            ...reel,
            avatar:
              reel.avatar ||
              buscarAvatarEnComentarios(comentariosPorReel[reel.id], reel.creadorId),
          }));

          if (token) {
            const creadoresSinAvatar = [
              ...new Set(
                reelsConAvatar
                  .filter((reel) => !reel.avatar && reel.creadorId)
                  .map((reel) => reel.creadorId)
              ),
            ];

            const avatarEntries = await Promise.all(
              creadoresSinAvatar.map(async (creadorId) => {
                try {
                  const perfilResponse = await fetch(apiUrl(`/api/usuarios/${creadorId}/perfil`), {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!perfilResponse.ok) return [creadorId, ""];
                  const perfilData = await perfilResponse.json();
                  return [creadorId, perfilData.perfil?.avatar || ""];
                } catch {
                  return [creadorId, ""];
                }
              })
            );
            const avatarPorCreador = Object.fromEntries(avatarEntries);

            reelsConAvatar = reelsConAvatar.map((reel) => ({
              ...reel,
              avatar: reel.avatar || avatarPorCreador[reel.creadorId] || "",
            }));
          }

          if (activo) {
            setLanzamientos(reelsConAvatar);
            setComentariosPorLanzamiento(comentariosPorReel);
          }
        }
      } catch (error) {
        console.error(error);
      }
    };

    cargarReels();
    return () => {
      activo = false;
    };
  }, [usuario?.id]);

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

  useEffect(() => {
    const pista = document.querySelector(".feed-pista");
    if (!pista) return undefined;

    const observer = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((entrada) => entrada.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        const idRaw = visible.target.getAttribute("data-reel-id");
        const id = idRaw?.startsWith("db-") ? idRaw : Number(idRaw);
        if (!id || reproduciendoRef.current === id) return;
        if (reelPausadoPorUsuarioRef.current === id) return;

        reelPausadoPorUsuarioRef.current = null;
        reproduciendoRef.current = id;
        setReproduciendo(id);
        if (comentariosAbiertosRef.current !== null) {
          setComentariosAnimando(false);
          clearTimeout(comentariosAnimacionTimer.current);
          comentariosAbiertosRef.current = id;
          setComentariosAbiertos(id);
        }
        setProgresos((prev) => (prev[id] === undefined ? { ...prev, [id]: 0 } : prev));
      },
      {
        root: pista,
        threshold: [0.58, 0.72, 0.9],
      }
    );

    idsLanzamientosFiltrados.split(",").forEach((id) => {
      const reel = document.getElementById(`reel-${id}`);
      if (reel) observer.observe(reel);
    });

    return () => observer.disconnect();
  }, [idsLanzamientosFiltrados]);

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
    if (lanzamientoActual.audio) return undefined;

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

  useEffect(() => {
    if (!audioReproduciendo || reproduciendo === null) {
      guardarTiempoAudioActual();
      audioReelRef.current?.pause();
      return undefined;
    }

    const idReel = reproduciendo;
    const audio = new Audio(audioReproduciendo);
    const tiemposReel = tiemposReelRef.current;
    audio.loop = true;
    audio.preload = "metadata";
    guardarTiempoAudioActual();
    audioReelRef.current?.pause();
    audioReelRef.current = audio;
    audioReelActivoIdRef.current = idReel;

    const restaurarTiempoGuardado = () => {
      const tiempoGuardado = tiemposReel[idReel];
      if (!Number.isFinite(tiempoGuardado) || tiempoGuardado <= 0) return;

      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = Math.min(tiempoGuardado, Math.max(0, audio.duration - 0.1));
      } else {
        audio.currentTime = tiempoGuardado;
      }
    };

    const actualizarProgreso = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      tiemposReel[idReel] = audio.currentTime;
      setProgresos((actuales) => ({
        ...actuales,
        [idReel]: (audio.currentTime / audio.duration) * 100,
      }));
    };

    try {
      restaurarTiempoGuardado();
    } catch {
      audio.addEventListener("loadedmetadata", restaurarTiempoGuardado, { once: true });
    }

    audio.addEventListener("timeupdate", actualizarProgreso);
    audio.play().catch(() => setReproduciendo(null));

    return () => {
      if (Number.isFinite(audio.currentTime)) {
        tiemposReel[idReel] = audio.currentTime;
      }
      audio.pause();
      audio.removeEventListener("timeupdate", actualizarProgreso);
      audio.removeEventListener("loadedmetadata", restaurarTiempoGuardado);
      if (audioReelRef.current === audio) {
        audioReelRef.current = null;
        audioReelActivoIdRef.current = null;
      }
    };
  }, [audioReproduciendo, reproduciendo]);

  useEffect(() => {
    const pausarReelActivo = () => {
      audioReelRef.current?.pause();
      reproduciendoRef.current = null;
      setReproduciendo(null);
    };

    const pausarSiNoEstaVisible = () => {
      if (document.hidden) pausarReelActivo();
    };

    document.addEventListener("visibilitychange", pausarSiNoEstaVisible);
    window.addEventListener("blur", pausarReelActivo);
    window.addEventListener("pagehide", pausarReelActivo);

    return () => {
      document.removeEventListener("visibilitychange", pausarSiNoEstaVisible);
      window.removeEventListener("blur", pausarReelActivo);
      window.removeEventListener("pagehide", pausarReelActivo);
    };
  }, []);

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

  const obtenerTokenSesion = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
      return null;
    }

    return token;
  };

  const cerrarCreadorReel = () => {
    if (nuevoReel.audio?.startsWith("blob:")) {
      URL.revokeObjectURL(nuevoReel.audio);
    }
    if (portadaReelInputRef.current) portadaReelInputRef.current.value = "";
    if (audioReelInputRef.current) audioReelInputRef.current.value = "";
    setMostrarCrearReel(false);
    setNuevoReel(reelVacio);
  };

  const leerArchivo = (archivo) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(archivo);
    });

  const cambiarPortadaReel = async (event) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const portada = await leerArchivo(archivo);
    setNuevoReel((actual) => ({
      ...actual,
      portada,
      portadaFile: archivo,
      nombrePortada: archivo.name,
    }));
  };

  const limpiarPortadaReel = () => {
    if (portadaReelInputRef.current) portadaReelInputRef.current.value = "";
    setNuevoReel((actual) => ({
      ...actual,
      portada: "",
      portadaFile: null,
      nombrePortada: "",
    }));
  };

  const cambiarAudioReel = async (event) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const audio = URL.createObjectURL(archivo);
    const elementoAudio = new Audio(audio);
    elementoAudio.addEventListener(
      "loadedmetadata",
      () => {
        const segundosTotales = Number.isFinite(elementoAudio.duration)
          ? Math.max(1, Math.round(elementoAudio.duration))
          : 30;
        const minutos = Math.floor(segundosTotales / 60);
        const segundos = String(segundosTotales % 60).padStart(2, "0");
        setNuevoReel((actual) => {
          if (actual.audio?.startsWith("blob:")) {
            URL.revokeObjectURL(actual.audio);
          }

          return {
            ...actual,
            audio,
            audioFile: archivo,
            nombreAudio: archivo.name,
            duracion: `${minutos}:${segundos}`,
          };
        });
      },
      { once: true }
    );
  };

  const limpiarAudioReel = () => {
    if (audioReelInputRef.current) audioReelInputRef.current.value = "";
    setNuevoReel((actual) => {
      if (actual.audio?.startsWith("blob:")) {
        URL.revokeObjectURL(actual.audio);
      }

      return {
        ...actual,
        audio: "",
        audioFile: null,
        nombreAudio: "",
        duracion: "0:30",
      };
    });
  };

  const publicarReel = async (event) => {
    event.preventDefault();
    if (
      !nuevoReel.tema.trim() ||
      !nuevoReel.album.trim() ||
      !nuevoReel.genero ||
      !nuevoReel.audioFile
    ) {
      mostrarAviso("Completa el titulo, el nombre, el genero y selecciona un audio");
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

      const formData = new FormData();
      formData.append("tema", nuevoReel.tema.trim());
      formData.append("album", nuevoReel.album.trim());
      formData.append("genero", nuevoReel.genero);
      formData.append("descripcion", nuevoReel.descripcion.trim());
      formData.append("duracion", nuevoReel.duracion);
      formData.append("audio", nuevoReel.audioFile);
      if (nuevoReel.portadaFile) {
        formData.append("portada", nuevoReel.portadaFile);
      }

      const response = await fetch(apiUrl("/api/reels/crear"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo guardar el reel.");
      }

      const reelGuardado = await response.json();
      let reel = {
        ...reelGuardado,
        id: `db-${reelGuardado.id}`,
        backendId: reelGuardado.backendId || reelGuardado.id,
      };

      if (!reel.avatar) {
        const perfilResponse = await fetch(apiUrl("/api/usuarios/me/perfil"), {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
        if (perfilResponse?.ok) {
          const perfilData = await perfilResponse.json();
          reel = { ...reel, avatar: perfilData.perfil?.avatar || "" };
        }
      }

      setLanzamientos((actuales) => [reel, ...actuales]);
      setComentariosPorLanzamiento((actuales) => ({ ...actuales, [reel.id]: [] }));
      setProgresos((actuales) => ({ ...actuales, [reel.id]: 0 }));
      setReproduciendo(reel.id);
      cerrarCreadorReel();
      mostrarAviso("Reel publicado");
      window.setTimeout(() => {
        document.getElementById(`reel-${reel.id}`)?.scrollIntoView({ block: "start" });
      }, 0);
    } catch (error) {
      console.error(error);
      mostrarAviso(error.message || "No se pudo guardar el reel.");
    }
  };

  const copiarEnlace = async (enlace) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(enlace);
      return;
    }

    const campo = document.createElement("textarea");
    campo.value = enlace;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    document.execCommand("copy");
    campo.remove();
  };

  const compartirLanzamiento = async (lanzamiento) => {
    const enlace = new URL(window.location.href);
    enlace.pathname = "/descubrir";
    enlace.search = "";
    enlace.searchParams.set("lanzamiento", lanzamiento.id);

    const datos = {
      title: `${lanzamiento.tema} - ${lanzamiento.artista}`,
      text: `Escucha "${lanzamiento.tema}" de ${lanzamiento.artista} en SONDAR`,
      url: enlace.toString(),
    };

    if (navigator.share) {
      try {
        await navigator.share(datos);
        mostrarAviso("Menu de compartir cerrado");
      } catch (error) {
        if (error?.name !== "AbortError") {
          mostrarAviso("No se pudo compartir el lanzamiento");
        }
      }
      return;
    }

    try {
      await copiarEnlace(datos.url);
      incrementarMetrica(lanzamiento.id, "compartidos");
      mostrarAviso("Link copiado para compartir");
    } catch {
      mostrarAviso("No se pudo copiar el link");
    }
  };

  const actualizarLanzamiento = async (lanzamiento, campo) => {
    if (campo === "siguiendo" && lanzamiento.creadorId) {
      if (lanzamiento.creadorId === usuario?.id) {
        mostrarAviso("Ese reel es tuyo");
        return;
      }

      try {
        const token = await obtenerTokenSesion();
        if (!token) return;

        const response = await fetch(apiUrl(`/api/usuarios/${lanzamiento.creadorId}/seguir`), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo actualizar el seguimiento.");
        }

        const data = await response.json();
        setLanzamientos((prev) =>
          prev.map((item) =>
            item.creadorId === lanzamiento.creadorId
              ? { ...item, siguiendo: data.siguiendo }
              : item
          )
        );
        window.dispatchEvent(new CustomEvent("sondar:seguimiento-actualizado"));
        return;
      } catch (error) {
        console.error(error);
        mostrarAviso(error.message || "No se pudo seguir el perfil.");
        return;
      }
    }

    setLanzamientos((prev) =>
      prev.map((item) =>
        item.id === lanzamiento.id
          ? { ...item, [campo]: !item[campo] }
          : item
      )
    );
  };

  const abrirArtista = (lanzamiento) => {
    if (usuario?.id && lanzamiento.creadorId === usuario.id) {
      navigate("/perfil");
      return;
    }

    const slug = lanzamiento.artista.toLowerCase().replaceAll(" ", "-");
    navigate(`/perfil/${lanzamiento.creadorId || slug}`, { state: { artista: lanzamiento } });
  };

  const usuarioPuedeEliminarLanzamiento = (lanzamiento) =>
    Boolean(
      usuario &&
      (lanzamiento.creadorKey === claveUsuarioActual ||
        (usuario?.id && lanzamiento.creadorId === usuario.id))
    );

  const eliminarLanzamiento = async (lanzamiento) => {
    try {
      if (lanzamiento.backendId) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        if (!token) {
          mostrarAviso("Tu sesion expiro. Volve a iniciar sesion.");
          return;
        }

        const response = await fetch(apiUrl(`/api/reels/${lanzamiento.backendId}`), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo eliminar el reel.");
        }
      }

      setLanzamientos((prev) => prev.filter((item) => item.id !== lanzamiento.id));
      setComentariosPorLanzamiento((prev) => {
        const siguiente = { ...prev };
        delete siguiente[lanzamiento.id];
        return siguiente;
      });
      setProgresos((prev) => {
        const siguiente = { ...prev };
        delete siguiente[lanzamiento.id];
        return siguiente;
      });
      setMenuLanzamientoAbierto(null);
      setComentariosAbiertos((actual) => (actual === lanzamiento.id ? null : actual));
      setReproduciendo((actual) => (actual === lanzamiento.id ? null : actual));
      mostrarAviso("Reel eliminado");
    } catch (error) {
      console.error(error);
      mostrarAviso(error.message || "No se pudo eliminar el reel.");
    }
  };

  const alternarReproduccion = (id) => {
    setReproduciendo((actual) => {
      const siguiente = actual === id ? null : id;
      if (actual === id) {
        guardarTiempoAudioActual();
        reelPausadoPorUsuarioRef.current = id;
      } else {
        reelPausadoPorUsuarioRef.current = null;
      }
      reproduciendoRef.current = siguiente;
      return siguiente;
    });
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

  const moverReel = (id, direccion) => {
    desplazarReel(id, direccion);
  };

  const abrirPerfilComentario = (userId) => {
    if (!userId) return;
    if (usuario?.id && userId === usuario.id) {
      navigate("/perfil");
      return;
    }
    navigate(`/perfil/${userId}`);
  };

  const enviarComentario = async (event) => {
    event.preventDefault();
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = comentarioTexto.trim();

    if (!texto) return;

    const lanzamientoId = comentariosAbiertos ?? reproduciendo;
    if (!lanzamientoId) return;
    const lanzamiento = lanzamientos.find((item) => item.id === lanzamientoId);

    if (lanzamiento?.backendId) {
      try {
        const token = await obtenerTokenSesion();
        if (!token) return;

        const response = await fetch(apiUrl(`/api/reels/${lanzamiento.backendId}/comentarios`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ texto }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo guardar el comentario.");
        }

        const comentarioGuardado = await response.json();
        setComentariosPorLanzamiento((prev) => ({
          ...prev,
          [lanzamientoId]: [comentarioGuardado, ...(prev[lanzamientoId] || [])],
        }));
        setComentarioTexto("");
        return;
      } catch (error) {
        console.error(error);
        mostrarAviso(error.message || "No se pudo guardar el comentario.");
        return;
      }
    }

    setComentariosPorLanzamiento((prev) => ({
      ...prev,
      [lanzamientoId]: [
        {
          id: Date.now(),
          userId: usuario.id,
          usuario: obtenerUsuarioActual(usuario),
          tiempo: "ahora",
          texto,
          likes: 0,
          liked: false,
          respuestas: [],
        },
        ...(prev[lanzamientoId] || []),
      ],
    }));
    setComentarioTexto("");
  };

  const incrementarMetrica = (id, campo) => {
    setLanzamientos((prev) =>
      prev.map((lanzamiento) =>
        lanzamiento.id === id
          ? { ...lanzamiento, [campo]: (lanzamiento[campo] || 0) + 1 }
          : lanzamiento
      )
    );
  };

  const alternarGuardadoLanzamiento = async (lanzamientoSeleccionado) => {
    if (lanzamientoSeleccionado.backendId) {
      try {
        const token = await obtenerTokenSesion();
        if (!token) return;

        const response = await fetch(apiUrl(`/api/reels/${lanzamientoSeleccionado.backendId}/guardar`), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo guardar el reel.");
        }

        const data = await response.json();
        setLanzamientos((prev) =>
          prev.map((lanzamiento) =>
            lanzamiento.id === lanzamientoSeleccionado.id
              ? { ...lanzamiento, guardado: data.guardado, guardados: data.guardados }
              : lanzamiento
          )
        );
        return;
      } catch (error) {
        console.error(error);
        mostrarAviso(error.message || "No se pudo actualizar el guardado.");
        return;
      }
    }

    setLanzamientos((prev) =>
      prev.map((lanzamiento) => {
        if (lanzamiento.id !== lanzamientoSeleccionado.id) return lanzamiento;

        const guardado = !lanzamiento.guardado;
        return {
          ...lanzamiento,
          guardado,
          guardados: Math.max(0, (lanzamiento.guardados || 0) + (guardado ? 1 : -1)),
        };
      })
    );
  };

  const alternarLikeLanzamiento = async (lanzamiento) => {
    const animacion = lanzamiento.liked ? "quitando-like" : "dando-like";

    setAnimacionesLike((prev) => ({ ...prev, [lanzamiento.id]: animacion }));

    if (lanzamiento.backendId) {
      try {
        const token = await obtenerTokenSesion();
        if (!token) return;

        const response = await fetch(apiUrl(`/api/reels/${lanzamiento.backendId}/like`), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo actualizar el favorito.");
        }

        const data = await response.json();
        setLanzamientos((prev) =>
          prev.map((actual) =>
            actual.id === lanzamiento.id
              ? { ...actual, liked: data.liked, likes: data.likes }
              : actual
          )
        );
      } catch (error) {
        console.error(error);
        mostrarAviso(error.message || "No se pudo actualizar el favorito.");
      } finally {
        window.setTimeout(() => {
          setAnimacionesLike((prev) => {
            const siguiente = { ...prev };
            delete siguiente[lanzamiento.id];
            return siguiente;
          });
        }, 520);
      }
      return;
    }

    setLanzamientos((prev) =>
      prev.map((actual) => {
        if (actual.id !== lanzamiento.id) return actual;

        const liked = !actual.liked;
        return {
          ...actual,
          liked,
          likes: Math.max(0, actual.likes + (liked ? 1 : -1)),
        };
      })
    );

    window.setTimeout(() => {
      setAnimacionesLike((prev) => {
        const siguiente = { ...prev };
        delete siguiente[lanzamiento.id];
        return siguiente;
      });
    }, 520);
  };

  const toggleLikeComentario = (lanzamientoId, comentarioId, respuestaId = null) => {
    ejecutarConSesion(() => {
      setComentariosPorLanzamiento((prev) => ({
        ...prev,
        [lanzamientoId]: (prev[lanzamientoId] || []).map((comentario) => {
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
      }));
    });
  };

  const abrirRespuesta = (lanzamientoId, comentarioId, usuarioDestino) => {
    ejecutarConSesion(() => {
      const respuestaKey = `${lanzamientoId}-${comentarioId}`;
      const mismaRespuesta = respuestaActiva === respuestaKey && respuestaPara === usuarioDestino;
      setRespuestaActiva(mismaRespuesta ? null : respuestaKey);
      setRespuestaPara(mismaRespuesta ? null : usuarioDestino);
      setRespuestaTexto("");
    });
  };

  const toggleRespuestas = (lanzamientoId, comentarioId) => {
    const respuestaKey = `${lanzamientoId}-${comentarioId}`;
    setRespuestasAbiertas((abiertas) =>
      abiertas.includes(respuestaKey)
        ? abiertas.filter((id) => id !== respuestaKey)
        : [...abiertas, respuestaKey]
    );
  };

  const enviarRespuesta = async (event, lanzamientoId, comentarioId) => {
    event.preventDefault();
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = respuestaTexto.trim();
    if (!texto) return;
    const lanzamiento = lanzamientos.find((item) => item.id === lanzamientoId);

    if (lanzamiento?.backendId) {
      try {
        const token = await obtenerTokenSesion();
        if (!token) return;

        const response = await fetch(apiUrl(`/api/reels/${lanzamiento.backendId}/comentarios`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ texto, parentId: comentarioId }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo guardar la respuesta.");
        }

        const respuestaGuardada = await response.json();
        setComentariosPorLanzamiento((prev) => ({
          ...prev,
          [lanzamientoId]: (prev[lanzamientoId] || []).map((comentario) =>
            comentario.id === comentarioId
              ? {
                  ...comentario,
                  respuestas: [...comentario.respuestas, respuestaGuardada],
                }
              : comentario
          ),
        }));
        setRespuestaTexto("");
        setRespuestaActiva(null);
        setRespuestaPara(null);
        return;
      } catch (error) {
        console.error(error);
        mostrarAviso(error.message || "No se pudo guardar la respuesta.");
        return;
      }
    }

    setComentariosPorLanzamiento((prev) => ({
      ...prev,
      [lanzamientoId]: (prev[lanzamientoId] || []).map((comentario) =>
        comentario.id === comentarioId
          ? {
              ...comentario,
              respuestas: [
                ...comentario.respuestas,
                {
                  id: Date.now(),
                  userId: usuario.id,
                  usuario: obtenerUsuarioActual(usuario),
                  tiempo: "ahora",
                  texto,
                  respondeA: respuestaPara,
                  likes: 0,
                  liked: false,
                },
              ],
            }
          : comentario
      ),
    }));
    setRespuestaTexto("");
    setRespuestaActiva(null);
    setRespuestaPara(null);
    const respuestaKey = `${lanzamientoId}-${comentarioId}`;
    setRespuestasAbiertas((abiertas) =>
      abiertas.includes(respuestaKey) ? abiertas : [...abiertas, respuestaKey]
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
          const comentariosDelLanzamiento = comentariosPorLanzamiento[lanzamiento.id] || [];
          const puedeEliminar = usuarioPuedeEliminarLanzamiento(lanzamiento);

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
                  {lanzamiento.genero ? (
                    <span className="album-sello">{mostrarGeneroReel(lanzamiento.genero)}</span>
                  ) : null}
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
                      {lanzamiento.avatar ? (
                        <img src={lanzamiento.avatar} alt="" />
                      ) : (
                        lanzamiento.artista.charAt(0)
                      )}
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
                        {!puedeEliminar ? (
                          <button
                            className={`seguir-btn ${lanzamiento.siguiendo ? "activo" : ""}`}
                            type="button"
                            onClick={() =>
                              ejecutarConSesion(() => actualizarLanzamiento(lanzamiento, "siguiendo"))
                            }
                          >
                            {lanzamiento.siguiendo ? "Siguiendo" : "Seguir"}
                          </button>
                        ) : null}
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
                    setProgresos((prev) => {
                      const valor = Number(event.target.value);
                      if (
                        lanzamiento.audio &&
                        reproduciendo === lanzamiento.id &&
                        audioReelRef.current &&
                        Number.isFinite(audioReelRef.current.duration)
                      ) {
                        audioReelRef.current.currentTime =
                          (valor / 100) * audioReelRef.current.duration;
                      }
                      return { ...prev, [lanzamiento.id]: valor };
                    })
                  }
                />
              </div>

              <div className="acciones-verticales" aria-label={`Acciones de ${lanzamiento.tema}`}>
                <div className="accion-item">
                  <button
                  className={`accion-boton ${lanzamiento.liked ? "activo" : ""} ${animacionesLike[lanzamiento.id] || ""}`}
                    type="button"
                    aria-label={lanzamiento.liked ? "Quitar me gusta" : "Me gusta"}
                    onClick={() =>
                    ejecutarConSesion(() => alternarLikeLanzamiento(lanzamiento))
                    }
                  >
                    <Icono nombre="corazon" />
                  </button>
                  <span>{formatearConteo(lanzamiento.likes)}</span>
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
                  <span>{comentariosDelLanzamiento.length}</span>
                </div>
                <div className="accion-item">
                  <button
                  className="accion-boton"
                  type="button"
                  aria-label="Compartir"
                  onClick={() => compartirLanzamiento(lanzamiento)}
                >
                    <Icono nombre="compartir" />
                  </button>
                  <span>{formatearConteo(lanzamiento.compartidos)}</span>
                </div>
                <div className="accion-item">
                  <button
                    className={`accion-boton ${lanzamiento.guardado ? "activo" : ""}`}
                    type="button"
                    aria-label={lanzamiento.guardado ? "Quitar de guardados" : "Guardar"}
                    onClick={() =>
                      ejecutarConSesion(() => alternarGuardadoLanzamiento(lanzamiento))
                    }
                  >
                    <Icono nombre="guardar" />
                  </button>
                  <span>{formatearConteo(lanzamiento.guardados)}</span>
                </div>
                {puedeEliminar ? (
                  <div className="accion-item accion-menu-item">
                    <button
                      className={`accion-boton accion-boton-menu ${menuLanzamientoAbierto === lanzamiento.id ? "activo" : ""}`}
                      type="button"
                      aria-label="Opciones del reel"
                      aria-expanded={menuLanzamientoAbierto === lanzamiento.id}
                      onClick={() =>
                        setMenuLanzamientoAbierto((actual) =>
                          actual === lanzamiento.id ? null : lanzamiento.id
                        )
                      }
                    >
                      <Icono nombre="mas" />
                    </button>
                    {menuLanzamientoAbierto === lanzamiento.id ? (
                      <div className="reel-opciones-menu">
                        <button type="button" onClick={() => eliminarLanzamiento(lanzamiento)}>
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <aside
                className={`comentarios-panel ${
                  comentariosAbiertos === lanzamiento.id ? "abierto" : ""
                }`}
                aria-hidden={comentariosAbiertos !== lanzamiento.id}
              >
                <header className="comentarios-header">
                  <strong>Comentarios</strong>
                  <span>{comentariosDelLanzamiento.length}</span>
                  <button
                    type="button"
                    aria-label="Cerrar comentarios"
                    onClick={() => cambiarComentariosConAnimacion(null)}
                  >
                    <Icono nombre="cerrar" />
                  </button>
                </header>
                <div className="comentarios-lista">
                  {comentariosDelLanzamiento.map((comentario) => (
                    <article className="comentario" key={comentario.id}>
                      <button
                        className="comentario-avatar comentario-usuario-btn"
                        type="button"
                        onClick={() => abrirPerfilComentario(comentario.userId)}
                        aria-label={`Ver perfil de ${comentario.usuario}`}
                      >
                        <AvatarComentario comentario={comentario} />
                      </button>
                      <div>
                        <strong>
                          <button
                            className="comentario-nombre-btn"
                            type="button"
                            onClick={() => abrirPerfilComentario(comentario.userId)}
                          >
                            {comentario.usuario}
                          </button>{" "}
                          <span>{comentario.tiempo}</span>
                        </strong>
                        <p>{comentario.texto}</p>
                        <div className="comentario-acciones">
                          <button
                            type="button"
                            onClick={() => abrirRespuesta(lanzamiento.id, comentario.id, comentario.usuario)}
                          >
                            Responder
                          </button>
                          <small>{formatearConteo(comentario.likes)} me gusta</small>
                        </div>
                        {comentario.respuestas.length > 0 ? (
                          <button
                            className="comentario-ver-respuestas"
                            type="button"
                            onClick={() => toggleRespuestas(lanzamiento.id, comentario.id)}
                          >
                            {respuestasAbiertas.includes(`${lanzamiento.id}-${comentario.id}`)
                              ? "Ocultar respuestas"
                              : `Ver ${comentario.respuestas.length} respuestas`}
                          </button>
                        ) : null}
                        {respuestasAbiertas.includes(`${lanzamiento.id}-${comentario.id}`) ? (
                          <div className="comentario-respuestas">
                            {comentario.respuestas.map((respuesta) => (
                              <article className="comentario comentario-respuesta" key={respuesta.id}>
                                <button
                                  className="comentario-avatar comentario-usuario-btn"
                                  type="button"
                                  onClick={() => abrirPerfilComentario(respuesta.userId)}
                                  aria-label={`Ver perfil de ${respuesta.usuario}`}
                                >
                                  <AvatarComentario comentario={respuesta} />
                                </button>
                                <div>
                                  <strong>
                                    <button
                                      className="comentario-nombre-btn"
                                      type="button"
                                      onClick={() => abrirPerfilComentario(respuesta.userId)}
                                    >
                                      {respuesta.usuario}
                                    </button>{" "}
                                    <span>{respuesta.tiempo}</span>
                                  </strong>
                                  {respuesta.respondeA ? (
                                    <small className="respuesta-para">Para {respuesta.respondeA}</small>
                                  ) : null}
                                  <p>{respuesta.texto}</p>
                                  <div className="comentario-acciones">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        abrirRespuesta(lanzamiento.id, comentario.id, respuesta.usuario)
                                      }
                                    >
                                      Responder
                                    </button>
                                    <small>{formatearConteo(respuesta.likes)} me gusta</small>
                                  </div>
                                </div>
                                <button
                                  className={`comentario-like ${respuesta.liked ? "activo" : ""}`}
                                  type="button"
                                  aria-label={respuesta.liked ? "Quitar me gusta" : "Me gusta"}
                                  onClick={() => toggleLikeComentario(lanzamiento.id, comentario.id, respuesta.id)}
                                >
                                  <Icono nombre="corazon" />
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : null}
                        {respuestaActiva === `${lanzamiento.id}-${comentario.id}` ? (
                          <form className="respuesta-comentario-form" onSubmit={(event) => enviarRespuesta(event, lanzamiento.id, comentario.id)}>
                            <span className="respuesta-destino">Para {respuestaPara}</span>
                            <input
                              type="text"
                              placeholder="Escribe una respuesta..."
                              value={respuestaTexto}
                              onChange={(event) => setRespuestaTexto(event.target.value)}
                              autoFocus
                            />
                            <button type="submit" aria-label="Enviar respuesta">
                              <Icono nombre="enviar" />
                            </button>
                          </form>
                        ) : null}
                      </div>
                      <button
                        className={`comentario-like ${comentario.liked ? "activo" : ""}`}
                        type="button"
                        aria-label={comentario.liked ? "Quitar me gusta" : "Me gusta"}
                        onClick={() => toggleLikeComentario(lanzamiento.id, comentario.id)}
                      >
                        <Icono nombre="corazon" />
                      </button>
                    </article>
                  ))}
                </div>
                <form className="comentario-form" onSubmit={enviarComentario}>
                  <div className="comentario-avatar">
                    {!usuario ? (
                      <IconoPersona />
                    ) : (
                      inicialUsuario
                    )}
                  </div>
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
        <p className="descubrir-vacio">
          {query ? "No encontramos musica para esa busqueda." : "No hay nada que descubrir."}
        </p>
      ) : null}
      {aviso ? (
        <div className="descubrir-toast" role="status">
          {aviso}
        </div>
      ) : null}

      {mostrarCrearReel ? (
        <div className="crear-reel-overlay" role="presentation">
          <form
            className="crear-reel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crear-reel-titulo"
            onSubmit={publicarReel}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="crear-reel-header">
              <div>
                <span>DESCUBRIR</span>
                <h2 id="crear-reel-titulo">Crear nuevo reel</h2>
              </div>
              <button type="button" onClick={cerrarCreadorReel} aria-label="Cerrar">
                <Icono nombre="cerrar" />
              </button>
            </header>

            <div className="crear-reel-contenido">
              <div
                className={`crear-reel-preview ${nuevoReel.portada ? "con-portada" : ""}`}
                style={nuevoReel.portada ? { backgroundImage: `url(${nuevoReel.portada})` } : undefined}
              >
                {nuevoReel.genero ? (
                  <span className="crear-reel-sello">{mostrarGeneroReel(nuevoReel.genero)}</span>
                ) : null}
                <div className="crear-reel-preview-copy">
                  <strong>{nuevoReel.album || "Nombre del reel"}</strong>
                  <span>{nuevoReel.tema || "Titulo de la cancion"}</span>
                  <small>{obtenerUsuarioActual(usuario)}</small>
                </div>
              </div>

              <div className="crear-reel-campos">
                <label>
                  Titulo de la cancion
                  <input
                    value={nuevoReel.tema}
                    onChange={(event) =>
                      setNuevoReel((actual) => ({ ...actual, tema: event.target.value }))
                    }
                    maxLength="50"
                    placeholder="Ej: Neon de madrugada"
                    required
                  />
                </label>
                <label>
                  Nombre del reel
                  <input
                    value={nuevoReel.album}
                    onChange={(event) =>
                      setNuevoReel((actual) => ({ ...actual, album: event.target.value }))
                    }
                    maxLength="60"
                    placeholder="El texto principal de la portada"
                    required
                  />
                </label>
                <label>
                  Genero musical
                  <select
                    value={nuevoReel.genero}
                    onChange={(event) =>
                      setNuevoReel((actual) => ({ ...actual, genero: event.target.value }))
                    }
                    required
                  >
                    <option value="" disabled>Seleccionar genero</option>
                    {GENEROS_REEL.map((genero) => (
                      <option key={genero} value={genero}>
                        {mostrarGeneroReel(genero)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Descripcion
                  <textarea
                    value={nuevoReel.descripcion}
                    onChange={(event) =>
                      setNuevoReel((actual) => ({ ...actual, descripcion: event.target.value }))
                    }
                    maxLength="180"
                    rows="3"
                    placeholder="Conta algo sobre esta cancion..."
                  />
                </label>

                <div className="crear-reel-archivos">
                  <div className="crear-reel-archivo-grupo">
                    <label className="crear-reel-archivo">
                      <span>Seleccionar portada</span>
                      <small>{nuevoReel.nombrePortada || "JPG, PNG o WEBP"}</small>
                      <input ref={portadaReelInputRef} type="file" accept="image/*" onChange={cambiarPortadaReel} />
                    </label>
                    {nuevoReel.nombrePortada ? (
                      <button className="crear-reel-limpiar" type="button" onClick={limpiarPortadaReel}>
                        Quitar portada
                      </button>
                    ) : null}
                  </div>
                  <div className="crear-reel-archivo-grupo">
                    <label className="crear-reel-archivo">
                      <span>Seleccionar audio</span>
                      <small>{nuevoReel.nombreAudio || "MP3, WAV u OGG"}</small>
                      <input ref={audioReelInputRef} type="file" accept="audio/*" onChange={cambiarAudioReel} required />
                    </label>
                    {nuevoReel.nombreAudio ? (
                      <button className="crear-reel-limpiar" type="button" onClick={limpiarAudioReel}>
                        Quitar audio
                      </button>
                    ) : null}
                  </div>
                </div>

                {nuevoReel.audio ? (
                  <audio className="crear-reel-audio" src={nuevoReel.audio} controls />
                ) : null}

                <button className="crear-reel-publicar" type="submit">
                  Publicar reel
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
