import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./comunidad.css";

const filtros = [
  { id: "destacado", label: "Destacado" },
  { id: "reciente", label: "Mas reciente" },
  { id: "popular", label: "Mas popular" },
  { id: "preguntas", label: "Preguntas al artista" }
];

const comunidadesIniciales = [
  {
    id: "luna-norte",
    nombre: "@luna_norte",
    titulo: "Luna Norte",
    descripcion: "Comunidad oficial de Luna Norte: adelantos, fechas, preguntas y charlas directas con sus seguidores.",
    categoria: "indie pop",
    miembros: 605,
    actividad: "42 seguidores en linea",
    portada: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80"
  },
  {
    id: "tomi-beats",
    nombre: "@tomi_beats",
    titulo: "Tomi Beats",
    descripcion: "El espacio de Tomi Beats para compartir sets, fechas, samples y responder preguntas de la comunidad.",
    categoria: "techno",
    miembros: 1280,
    actividad: "12 hilos hoy",
    portada: "https://images.unsplash.com/photo-1571266028243-d220c9c3b8ef?auto=format&fit=crop&w=1400&q=80"
  },
  {
    id: "los-satelites",
    nombre: "@los_satelites",
    titulo: "Los Satelites",
    descripcion: "Comunidad de la banda para hablar con fans, votar canciones del vivo y coordinar encuentros antes de fechas.",
    categoria: "rock",
    miembros: 842,
    actividad: "Ensayo abierto",
    portada: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=80"
  },
  {
    id: "mica-live",
    nombre: "@mica_live",
    titulo: "Mica Live",
    descripcion: "Backstage, preguntas, anuncios de shows y conversaciones con quienes siguen a Mica.",
    categoria: "pop",
    miembros: 1510,
    actividad: "3 anuncios nuevos",
    portada: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1400&q=80"
  }
];

const miembrosActivos = ["M", "N", "L", "T", "A"];

const hilosIniciales = [
  {
    id: 1,
    comunidadId: "luna-norte",
    op: "Luna Norte",
    usuario: "@luna_norte",
    tipo: "destacado",
    titulo: "Que tema quieren que toque primero en el proximo show?",
    texto: "Estoy cerrando el setlist de la fecha del sabado. Quiero que la comunidad elija el primer tema.",
    etiqueta: "setlist",
    votos: 43,
    guardado: false,
    comentarios: [
      { id: 11, autor: "Lula", usuario: "@lula_fan", texto: "Abriria con Norte. Tiene energia de inicio y la cantamos todos.", votos: 12 },
      { id: 12, autor: "Tomi", usuario: "@tomi_escucha", texto: "Voto por Luces. Si arranca con ese bajo explota.", votos: 7 }
    ]
  },
  {
    id: 2,
    comunidadId: "los-satelites",
    op: "Los Satelites",
    usuario: "@los_satelites",
    tipo: "preguntas",
    titulo: "Pregunten lo que quieran para el Q&A del viernes",
    texto: "Vamos a grabar respuestas para la comunidad. Puede ser sobre canciones, instrumentos, fechas o el disco nuevo.",
    etiqueta: "q&a",
    votos: 28,
    guardado: false,
    comentarios: [
      { id: 21, autor: "Fran", usuario: "@fran_drums", texto: "Como eligieron el sonido de bateria del ultimo single?", votos: 9 }
    ]
  },
  {
    id: 3,
    comunidadId: "mica-live",
    op: "Mica Live",
    usuario: "@mica_live",
    tipo: "reciente",
    titulo: "Subi un adelanto del videoclip nuevo",
    texto: "Lo dejo primero aca para ustedes. Quiero leer que parte les intriga mas antes de publicarlo en redes.",
    etiqueta: "adelanto",
    votos: 61,
    guardado: true,
    comentarios: [
      { id: 31, autor: "Ana", usuario: "@ana_pop", texto: "La escena de las luces quedo tremenda. Se siente mas cinematografico.", votos: 16 },
      { id: 32, autor: "Santi", usuario: "@santi_synth", texto: "El puente suena distinto al vivo, me encanto.", votos: 5 }
    ]
  },
  {
    id: 4,
    comunidadId: "tomi-beats",
    op: "Tomi Beats",
    usuario: "@tomi_beats",
    tipo: "popular",
    titulo: "Les paso el tracklist del set de anoche",
    texto: "Dejo el orden y abro hilo para que me pidan IDs, stems o expliquemos como arme la transicion final.",
    etiqueta: "tracklist",
    votos: 75,
    guardado: false,
    comentarios: [
      { id: 41, autor: "Mica", usuario: "@mica_live", texto: "Necesito el ID del minuto 34, ese synth fue una locura.", votos: 18 }
    ]
  }
];

export default function Comunidad({ usuario }) {
  const [searchParams] = useSearchParams();
  const siguienteHiloId = useRef(Math.max(...hilosIniciales.map((hilo) => hilo.id)) + 1);
  const siguienteComentarioId = useRef(
    Math.max(...hilosIniciales.flatMap((hilo) => hilo.comentarios.map((comentario) => comentario.id))) + 1
  );
  const avisoTimer = useRef(null);
  const busqueda = searchParams.get("comunidad")?.toLowerCase() || "";
  const [comunidadActivaId, setComunidadActivaId] = useState("luna-norte");
  const [filtroActivo, setFiltroActivo] = useState("destacado");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [hilos, setHilos] = useState(hilosIniciales);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([1]);
  const [respuestas, setRespuestas] = useState({});
  const [aviso, setAviso] = useState("");
  const [nuevoHilo, setNuevoHilo] = useState({
    titulo: "",
    texto: "",
    tipo: "destacado",
    etiqueta: ""
  });

  const comunidadActiva = comunidadesIniciales.find((comunidad) => comunidad.id === comunidadActivaId);

  useEffect(() => {
    return () => {
      clearTimeout(avisoTimer.current);
    };
  }, []);

  const hilosFiltrados = useMemo(() => {
    return hilos.filter((hilo) => {
      const coincideComunidad = hilo.comunidadId === comunidadActivaId;
      const coincideFiltro = filtroActivo === "destacado" || hilo.tipo === filtroActivo;
      const textoBusqueda = [
        hilo.op,
        hilo.usuario,
        hilo.tipo,
        hilo.etiqueta,
        hilo.titulo,
        hilo.texto
      ].join(" ").toLowerCase();

      return coincideComunidad && coincideFiltro && (!busqueda || textoBusqueda.includes(busqueda));
    });
  }, [busqueda, comunidadActivaId, filtroActivo, hilos]);

  const handleChange = (e) => {
    setNuevoHilo({
      ...nuevoHilo,
      [e.target.name]: e.target.value
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

  const crearHilo = (e) => {
    e.preventDefault();

    if (!usuario) {
      pedirLogin();
      return;
    }

    const hilo = {
      id: siguienteHiloId.current,
      comunidadId: comunidadActivaId,
      op: usuario?.displayName || "Usuario Sondar",
      usuario: usuario?.email ? `@${usuario.email.split("@")[0]}` : "@seguidor",
      tipo: nuevoHilo.tipo,
      titulo: nuevoHilo.titulo,
      texto: nuevoHilo.texto,
      etiqueta: nuevoHilo.etiqueta || comunidadActiva.categoria,
      votos: 1,
      guardado: false,
      comentarios: []
    };

    siguienteHiloId.current += 1;
    setHilos([hilo, ...hilos]);
    setRespuestasAbiertas([hilo.id, ...respuestasAbiertas]);
    setMostrarModal(false);
    setNuevoHilo({
      titulo: "",
      texto: "",
      tipo: "destacado",
      etiqueta: ""
    });
  };

  const votar = (id) => {
    setHilos(hilos.map((hilo) =>
      hilo.id === id ? { ...hilo, votos: hilo.votos + 1 } : hilo
    ));
  };

  const guardar = (id) => {
    setHilos(hilos.map((hilo) =>
      hilo.id === id ? { ...hilo, guardado: !hilo.guardado } : hilo
    ));
  };

  const toggleRespuestas = (id) => {
    setRespuestasAbiertas((abiertas) =>
      abiertas.includes(id)
        ? abiertas.filter((hiloId) => hiloId !== id)
        : [...abiertas, id]
    );
  };

  const responder = (hiloId) => {
    if (!usuario) {
      pedirLogin();
      return;
    }

    const texto = respuestas[hiloId]?.trim();
    if (!texto) return;

    setHilos(hilos.map((hilo) =>
      hilo.id === hiloId
        ? {
            ...hilo,
            comentarios: [
              ...hilo.comentarios,
              {
                id: siguienteComentarioId.current,
                autor: usuario?.displayName || "Usuario Sondar",
                usuario: usuario?.email ? `@${usuario.email.split("@")[0]}` : "@seguidor",
                texto,
                votos: 0
              }
            ]
          }
        : hilo
    ));

    siguienteComentarioId.current += 1;
    setRespuestas({ ...respuestas, [hiloId]: "" });
    setRespuestasAbiertas((abiertas) => abiertas.includes(hiloId) ? abiertas : [...abiertas, hiloId]);
  };

  return (
    <main className="comunidad-container">
      <section className="comunidad-layout reddit-layout">
        <aside className="comunidad-sidebar subreddit-list">
          <section className="comunidad-panel">
            <h2>Artistas</h2>
            <div className="comunidades-lista">
              {comunidadesIniciales.map((comunidad) => (
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
                    <span>{comunidad.miembros} seguidores</span>
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
                <h1>{comunidadActiva.titulo}</h1>
                <p>{comunidadActiva.descripcion}</p>
                <div className="comunidad-miembros">
                  <div className="miembros-stack" aria-hidden="true">
                    {miembrosActivos.map((miembro) => (
                      <span key={miembro}>{miembro}</span>
                    ))}
                  </div>
                  <strong>{comunidadActiva.miembros}</strong>
                <span>seguidores · Comunidad oficial</span>
                </div>
              </div>
              <button className="comunidad-crear" type="button" onClick={abrirCrearHilo}>
                Crear hilo
              </button>
            </div>
          </header>

          <div className="comunidad-filtros" aria-label="Filtros de hilos">
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
                {(usuario?.displayName || usuario?.email || "S").charAt(0).toUpperCase()}
              </div>
              <div className="composer-cuerpo">
                <button type="button">Escribir en la comunidad de {comunidadActiva.titulo}</button>
                <div className="composer-acciones">
                  <span>Pregunta al artista</span>
                  <span>Comentario</span>
                  <strong>Publicar</strong>
                </div>
              </div>
            </section>

            {hilosFiltrados.map((hilo) => (
              <article className="publicacion-card hilo-card" key={hilo.id}>
                <div className="hilo-votos">
                  <button type="button" onClick={() => votar(hilo.id)} aria-label="Votar hilo">+</button>
                  <strong>{hilo.votos}</strong>
                </div>

                <div className="publicacion-contenido">
                  <div className="publicacion-meta">
                    <strong>{hilo.usuario}</strong>
                    <span>Artista: {hilo.op}</span>
                    <span>hace 23 horas</span>
                    <span>{hilo.etiqueta}</span>
                  </div>

                  <h2>{hilo.titulo}</h2>
                  <p>{hilo.texto}</p>

                  <div className="publicacion-acciones">
                    <button type="button" onClick={() => toggleRespuestas(hilo.id)}>
                      {hilo.comentarios.length} respuestas
                    </button>
                    <button type="button" onClick={() => guardar(hilo.id)}>
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
                            <p>{comentario.texto}</p>
                          </div>
                        </article>
                      ))}

                      <div className="respuesta-form">
                        <textarea
                          placeholder={`Responderle a ${hilo.op} o sumarte a la charla`}
                          value={respuestas[hilo.id] || ""}
                          onChange={(e) => setRespuestas({ ...respuestas, [hilo.id]: e.target.value })}
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

            {hilosFiltrados.length === 0 && (
              <div className="comunidad-vacio">
                No hay hilos para ese filtro en esta comunidad.
              </div>
            )}
          </div>
        </div>

        <aside className="comunidad-sidebar detalle-comunidad">
          <section className="comunidad-panel comunidad-panel-acento">
            <h2>Acerca de {comunidadActiva.titulo}</h2>
            <p>{comunidadActiva.descripcion}</p>
            <div className="subreddit-stats">
              <strong>{comunidadActiva.miembros}</strong>
              <span>seguidores</span>
              <strong>{comunidadActiva.actividad}</strong>
              <span>actividad</span>
            </div>
          </section>
        </aside>
      </section>

      {mostrarModal && (
        <div className="comunidad-modal-overlay">
          <div className="comunidad-modal">
            <h2>Crear hilo</h2>
            <form onSubmit={crearHilo}>
              <input
                name="titulo"
                placeholder="Titulo del hilo"
                value={nuevoHilo.titulo}
                onChange={handleChange}
                required
              />

              <textarea
                name="texto"
                placeholder="Escribi una pregunta, comentario o propuesta para la comunidad del artista"
                value={nuevoHilo.texto}
                onChange={handleChange}
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
                  placeholder="Etiqueta"
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
