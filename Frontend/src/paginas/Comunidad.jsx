import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import "./comunidad.css";

const comunidadesIniciales = [
  {
    id: "luna-norte",
    nombre: "r/luna-norte",
    titulo: "Luna Norte",
    descripcion: "Comunidad para compartir fechas, demos y preguntas del proyecto.",
    categoria: "indie",
    miembros: "1.2k",
    actividad: "128 online",
    portada: "https://images.unsplash.com/photo-1516280440614-37939bbacd81",
  },
  {
    id: "santo-beat",
    nombre: "r/santo-beat",
    titulo: "Santo Beat",
    descripcion: "Beatmaking, colaboraciones y novedades de Santo Beat.",
    categoria: "trap",
    miembros: "870",
    actividad: "42 online",
    portada: "https://images.unsplash.com/photo-1511379938547-c1f69419868d",
  },
];

const filtros = [
  { id: "destacado", label: "Destacado" },
  { id: "pregunta", label: "Pregunta" },
  { id: "comentario", label: "Comentario" },
  { id: "anuncio", label: "Anuncio" },
];

const miembrosActivos = ["L", "S", "M"];

const hilosIniciales = [
  {
    id: 1,
    comunidadId: "luna-norte",
    op: "Luna Norte",
    usuario: "@luna_norte",
    tipo: "destacado",
    titulo: "Nuevo ensayo abierto este viernes",
    texto: "Vamos a probar material nuevo y queremos leer sus preguntas.",
    etiqueta: "indie",
    votos: 12,
    guardado: false,
    comentarios: [
      {
        id: 1,
        autor: "Usuario Sondar",
        usuario: "@seguidor",
        texto: "Me encanta la idea, estaria bueno que suban un adelanto.",
        votos: 2,
      },
    ],
  },
];

export default function Comunidad({ usuario }) {
  const [searchParams] = useSearchParams();
  const busqueda = searchParams.get("comunidad")?.toLowerCase() || "";
  const [comunidadActivaId, setComunidadActivaId] = useState("luna-norte");
  const [filtroActivo, setFiltroActivo] = useState("destacado");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [hilos, setHilos] = useState(hilosIniciales);
  const [respuestasAbiertas, setRespuestasAbiertas] = useState([1]);
  const [respuestas, setRespuestas] = useState({});
  const [nuevoHilo, setNuevoHilo] = useState({
    titulo: "",
    texto: "",
    tipo: "destacado",
    etiqueta: ""
  });
  const comunidadActiva = comunidadesIniciales.find((comunidad) => comunidad.id === comunidadActivaId) || comunidadesIniciales[0];

  useEffect(() => {
    // El "puente" al servidor que tú manejas
    api.obtenerHilos(usuario?.uid)
      .then((hilosGuardados) => {
        if (hilosGuardados.length) {
          setHilos(hilosGuardados);
        }
      })
      .catch(err => console.error("Error al conectar:", err));
  }, [usuario]);
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

  const crearHilo = async (e) => {
    e.preventDefault();

    const hiloPayload = {
      comunidadId: comunidadActivaId,
      userId: usuario?.uid || null,
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

    try {
      const hilo = await api.crearHilo(hiloPayload);
      setHilos([hilo, ...hilos]);
      setRespuestasAbiertas([hilo.id, ...respuestasAbiertas]);
    } catch (error) {
      console.error(error);
      const hiloLocal = { id: Date.now(), ...hiloPayload };
      setHilos([hiloLocal, ...hilos]);
      setRespuestasAbiertas([hiloLocal.id, ...respuestasAbiertas]);
    }

    setMostrarModal(false);
    setNuevoHilo({
      titulo: "",
      texto: "",
      tipo: "destacado",
      etiqueta: ""
    });
  };

  const votar = async (id) => {
    setHilos(hilos.map((hilo) =>
      hilo.id === id ? { ...hilo, votos: hilo.votos + 1 } : hilo
    ));

    try {
      const data = await api.votarHilo(id);
      setHilos((prev) => prev.map((hilo) =>
        hilo.id === id ? { ...hilo, votos: data.votos } : hilo
      ));
    } catch (error) {
      console.error(error);
    }
  };

  const guardar = async (id) => {
    if (!usuario?.uid) {
      alert("Inicia sesion para guardar hilos.");
      return;
    }

    const hilo = hilos.find((item) => item.id === id);
    if (!hilo) return;

    const siguienteEstado = !hilo.guardado;
    setHilos(hilos.map((item) =>
      item.id === id ? { ...item, guardado: siguienteEstado } : item
    ));

    try {
      if (siguienteEstado) {
        await api.guardarItem(usuario.uid, "hilo", id, hilo);
      } else {
        await api.quitarGuardado(usuario.uid, "hilo", id);
      }
    } catch (error) {
      console.error(error);
      setHilos(hilos);
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
    const texto = respuestas[hiloId]?.trim();
    if (!texto) return;

    const respuestaPayload = {
      userId: usuario?.uid || null,
      autor: usuario?.displayName || "Usuario Sondar",
      usuario: usuario?.email ? `@${usuario.email.split("@")[0]}` : "@seguidor",
      texto,
    };

    let respuestaGuardada = {
      id: Date.now(),
      ...respuestaPayload,
      votos: 0,
    };

    try {
      respuestaGuardada = await api.responderHilo(hiloId, respuestaPayload);
    } catch (error) {
      console.error(error);
    }

    setHilos(hilos.map((hilo) =>
      hilo.id === hiloId
        ? {
            ...hilo,
            comentarios: [
              ...hilo.comentarios,
              respuestaGuardada
            ]
          }
        : hilo
    ));

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
              <button className="comunidad-crear" onClick={() => setMostrarModal(true)}>
                Crear hilo
              </button>
            </div>
          </header>

          <div className="comunidad-filtros" aria-label="Filtros de hilos">
            {filtros.map((filtro) => (
              <button
                key={filtro.id}
                className={filtroActivo === filtro.id ? "activo" : ""}
                onClick={() => setFiltroActivo(filtro.id)}
              >
                {filtro.label}
              </button>
            ))}
          </div>

          <div className="comunidad-feed">
            <section className="comunidad-composer" onClick={() => setMostrarModal(true)}>
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
                  <button onClick={() => votar(hilo.id)} aria-label="Votar hilo">+</button>
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
                    <button onClick={() => toggleRespuestas(hilo.id)}>
                      {hilo.comentarios.length} respuestas
                    </button>
                    <button onClick={() => guardar(hilo.id)}>
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
    </main>
  );
}
