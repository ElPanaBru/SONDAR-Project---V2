import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
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
    likes: "1.2K",
  },
  {
    id: 2,
    usuario: "@matibeat",
    tiempo: "hace 34 min",
    texto: "El bajo entra hermoso, guardadisimo.",
    likes: "864",
  },
  {
    id: 3,
    usuario: "@valenruido",
    tiempo: "hace 1 hora",
    texto: "Necesito escuchar la version completa.",
    likes: "512",
  },
  {
    id: 4,
    usuario: "@clubdemo",
    tiempo: "hace 2 horas",
    texto: "Esto va perfecto para abrir una playlist nocturna.",
    likes: "306",
  },
];

function Icono({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="28" height="28" fill="currentColor">
      <path d={iconos[nombre]} />
    </svg>
  );
}

export default function Descubrir({ usuario }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [lanzamientos, setLanzamientos] = useState(lanzamientosIniciales);
  const [reproduciendo, setReproduciendo] = useState(lanzamientosIniciales[0].id);
  const [comentariosAbiertos, setComentariosAbiertos] = useState(null);
  const [reelAnimando, setReelAnimando] = useState(null);
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [comentarios, setComentarios] = useState(comentariosIniciales);
  const [progresos, setProgresos] = useState(() =>
    Object.fromEntries(lanzamientosIniciales.map((lanzamiento) => [lanzamiento.id, lanzamiento.progreso]))
  );

  const query = searchParams.get("query")?.trim().toLowerCase() || "";

  useEffect(() => {
    api.guardarCatalogo("lanzamientos", lanzamientosIniciales)
      .catch((error) => console.error("No se pudo guardar el catalogo de lanzamientos:", error));
  }, []);

  useEffect(() => {
    if (!usuario?.uid) return;

    Promise.all([
      api.obtenerGuardados(usuario.uid),
      api.obtenerCuenta(usuario.uid).catch(() => ({ interacciones: [] })),
    ])
      .then(([guardados, cuenta]) => {
        const guardadosIds = new Set(
          guardados
            .filter((item) => item.item_type === "demo")
            .map((item) => String(item.item_id))
        );
        const interacciones = cuenta.interacciones || [];

        setLanzamientos((prev) =>
          prev.map((lanzamiento) => {
            const lanzamientoId = String(lanzamiento.id);
            const like = interacciones.find(
              (item) =>
                item.item_type === "demo" &&
                item.item_id === lanzamientoId &&
                item.interaction_type === "like"
            );
            const follow = interacciones.find(
              (item) =>
                item.item_type === "artista" &&
                item.item_id === lanzamiento.artista &&
                item.interaction_type === "follow"
            );

            return {
              ...lanzamiento,
              guardado: guardadosIds.has(lanzamientoId),
              liked: like ? like.active : lanzamiento.liked,
              siguiendo: follow ? follow.active : lanzamiento.siguiendo,
            };
          })
        );
      })
      .catch((error) => console.error(error));
  }, [usuario]);

  const lanzamientosFiltrados = useMemo(() => {
    if (!query) return lanzamientos;

    return lanzamientos.filter((lanzamiento) => {
      const contenido =
        `${lanzamiento.artista} ${lanzamiento.usuario} ${lanzamiento.tema} ${lanzamiento.album} ${lanzamiento.descripcion}`.toLowerCase();
      return contenido.includes(query);
    });
  }, [lanzamientos, query]);

  const actualizarLanzamiento = async (id, campo) => {
    if (!usuario?.uid) {
      alert("Inicia sesion para guardar tus acciones.");
      return;
    }

    const lanzamientoActual = lanzamientos.find((lanzamiento) => lanzamiento.id === id);
    if (!lanzamientoActual) return;

    const nuevoValor = !lanzamientoActual[campo];

    setLanzamientos((prev) =>
      prev.map((lanzamiento) =>
        lanzamiento.id === id
          ? { ...lanzamiento, [campo]: nuevoValor }
          : lanzamiento
      )
    );

    try {
      if (campo === "guardado") {
        if (nuevoValor) {
          await api.guardarItem(usuario.uid, "demo", id, lanzamientoActual);
        } else {
          await api.quitarGuardado(usuario.uid, "demo", id);
        }
        return;
      }

      await api.guardarInteraccion(usuario.uid, {
        itemType: campo === "siguiendo" ? "artista" : "demo",
        itemId: campo === "siguiendo" ? lanzamientoActual.artista : id,
        interactionType: campo === "siguiendo" ? "follow" : "like",
        active: nuevoValor,
        itemData: lanzamientoActual,
      });
    } catch (error) {
      console.error(error);
      setLanzamientos((prev) =>
        prev.map((lanzamiento) =>
          lanzamiento.id === id ? { ...lanzamiento, [campo]: !nuevoValor } : lanzamiento
        )
      );
      alert("No se pudo guardar el cambio.");
    }
  };

  const abrirArtista = (lanzamiento) => {
    const slug = lanzamiento.artista.toLowerCase().replaceAll(" ", "-");
    navigate(`/otro-perfil?artista=${slug}`, { state: { artista: lanzamiento } });
  };

  const moverReel = (id, direccion) => {
    const actual = document.getElementById(`reel-${id}`);
    const destino =
      direccion === "arriba"
        ? actual?.previousElementSibling
        : actual?.nextElementSibling;

    if (!destino) return;

    setReelAnimando({ id, direccion });
    window.setTimeout(() => {
      destino.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    window.setTimeout(() => setReelAnimando(null), 540);
  };

  const enviarComentario = (event) => {
    event.preventDefault();
    const texto = comentarioTexto.trim();

    if (!texto) return;

    setComentarios((prev) => [
      {
        id: Date.now(),
        usuario: "@teby",
        tiempo: "ahora",
        texto,
        likes: "0",
      },
      ...prev,
    ]);
    setComentarioTexto("");
  };

  return (
    <section className="descubrir-feed" aria-label="Descubrir musica">
      <div className="feed-pista">
        {lanzamientosFiltrados.map((lanzamiento) => {
          const estaReproduciendo = reproduciendo === lanzamiento.id;

          return (
            <article
              id={`reel-${lanzamiento.id}`}
              className={`feed-item ${estaReproduciendo ? "sonando" : ""} ${
                comentariosAbiertos === lanzamiento.id ? "comentarios-activos" : ""
              } ${
                reelAnimando?.id === lanzamiento.id ? `reel-saliendo-${reelAnimando.direccion}` : ""
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
                  className="album-portada"
                >
                  <span className="album-sello">SONDAR</span>
                  <span className="album-brillo" />
                  <span className="album-disco" />
                  <span className="album-titulo">{lanzamiento.album}</span>
                  <span className="album-artista">{lanzamiento.artista}</span>
                  <div className="album-meta">
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
                          onClick={() => actualizarLanzamiento(lanzamiento.id, "siguiendo")}
                        >
                          {lanzamiento.siguiendo ? "Siguiendo" : "Seguir"}
                        </button>
                      </div>
                      <p>{lanzamiento.descripcion}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="acciones-verticales" aria-label={`Acciones de ${lanzamiento.tema}`}>
                <div className="accion-item">
                  <button
                    className={`accion-boton ${lanzamiento.liked ? "activo" : ""}`}
                    type="button"
                    aria-label={lanzamiento.liked ? "Quitar me gusta" : "Me gusta"}
                    onClick={() => actualizarLanzamiento(lanzamiento.id, "liked")}
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
                      setComentariosAbiertos((actual) =>
                        actual === lanzamiento.id ? null : lanzamiento.id
                      )
                    }
                  >
                    <Icono nombre="comentario" />
                  </button>
                  <span>{lanzamiento.comentarios}</span>
                </div>
                <div className="accion-item">
                  <button className="accion-boton" type="button" aria-label="Compartir">
                    <Icono nombre="compartir" />
                  </button>
                  <span>{lanzamiento.compartidos}</span>
                </div>
                <div className="accion-item">
                  <button
                    className={`accion-boton ${lanzamiento.guardado ? "activo" : ""}`}
                    type="button"
                    aria-label={lanzamiento.guardado ? "Quitar de guardados" : "Guardar"}
                    onClick={() => actualizarLanzamiento(lanzamiento.id, "guardado")}
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
                    onClick={() => setComentariosAbiertos(null)}
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
                        <small>{comentario.likes} me gusta</small>
                      </div>
                    </article>
                  ))}
                </div>
                <form className="comentario-form" onSubmit={enviarComentario}>
                  <div className="comentario-avatar">T</div>
                  <input
                    type="text"
                    placeholder="Anade un comentario..."
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

              <div className="feed-reproductor" aria-label={`Reproductor de ${lanzamiento.tema}`}>
                <button
                  className="reproducir-btn"
                  type="button"
                  onClick={() =>
                    setReproduciendo((actual) =>
                      actual === lanzamiento.id ? null : lanzamiento.id
                    )
                  }
                  aria-label={`${estaReproduciendo ? "Pausar" : "Reproducir"} ${lanzamiento.tema}`}
                >
                  <Icono nombre={estaReproduciendo ? "pausa" : "play"} />
                </button>
                <div className="track-info">
                  <strong>{lanzamiento.tema}</strong>
                  <span>{lanzamiento.album}</span>
                </div>
                <div className="barra-tiempo">
                  <span>1:24</span>
                  <input
                    className="barra-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={progresos[lanzamiento.id] ?? lanzamiento.progreso}
                    aria-label={`Avanzar o retroceder ${lanzamiento.tema}`}
                    onChange={(event) =>
                      setProgresos((prev) => ({
                        ...prev,
                        [lanzamiento.id]: Number(event.target.value),
                      }))
                    }
                  />
                  <span>{lanzamiento.duracion}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {lanzamientosFiltrados.length === 0 ? (
        <p className="descubrir-vacio">No encontramos musica para esa busqueda.</p>
      ) : null}
    </section>
  );
}
