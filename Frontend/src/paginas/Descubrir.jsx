import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./descubrir.css";

const demosIniciales = [
  {
    id: 1,
    artista: "Luna Norte",
    seguidores: 1280,
    tema: "Ruido de ciudad",
    bio: "Productora indie con sintetizadores brillantes, bajos suaves y letras nocturnas.",
    color: "#ffae00",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 2,
    artista: "Santo Beat",
    seguidores: 870,
    tema: "Pulso lento",
    bio: "Mezcla trap, soul y percusiones latinas en demos crudas para tocar en vivo.",
    color: "#3cff00",
    liked: true,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 3,
    artista: "Marea Gris",
    seguidores: 2140,
    tema: "Antes del final",
    bio: "Banda de rock alternativo con guitarras densas y melodias directas.",
    color: "#aa3bff",
    liked: false,
    guardado: true,
    siguiendo: true,
  },
  {
    id: 4,
    artista: "Nico Solar",
    seguidores: 540,
    tema: "Cables",
    bio: "Bedroom pop con guitarras limpias, baterias secas y coros para cantar cerca.",
    color: "#00d4ff",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 5,
    artista: "Valle Club",
    seguidores: 1630,
    tema: "Otra vuelta",
    bio: "Funk alternativo con groove marcado, bajos vivos y un sonido de sala chica.",
    color: "#ff5e00",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
  {
    id: 6,
    artista: "Rita Viento",
    seguidores: 920,
    tema: "Eco",
    bio: "Canciones acusticas procesadas con capas ambientales y voces muy cercanas.",
    color: "#f5f5f5",
    liked: false,
    guardado: false,
    siguiendo: false,
  },
];

export default function Descubrir() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [demos, setDemos] = useState(demosIniciales);
  const [demoActiva, setDemoActiva] = useState(null);

  const query = searchParams.get("query")?.trim().toLowerCase() || "";

  const demosFiltradas = useMemo(() => {
    if (!query) return demos;

    return demos.filter((demo) => {
      const contenido = `${demo.artista} ${demo.tema} ${demo.bio}`.toLowerCase();
      return contenido.includes(query);
    });
  }, [demos, query]);

  const actualizarDemo = (id, campo) => {
    setDemos((prev) =>
      prev.map((demo) =>
        demo.id === id ? { ...demo, [campo]: !demo[campo] } : demo
      )
    );
  };

  const abrirArtista = (demo) => {
    const slug = demo.artista.toLowerCase().replaceAll(" ", "-");
    navigate(`/perfil?artista=${slug}`, { state: { artista: demo } });
  };

  return (
    <section className="descubrir-page">
      <header className="descubrir-header">
        <h1>Hola, descubrir</h1>
      </header>

      <div className="demos-lista">
        {demosFiltradas.map((demo) => (
          <article
            className={`demo-card ${demoActiva === demo.id ? "reproduciendo" : ""}`}
            key={demo.id}
          >
            <div className="demo-main">
              <div className="demo-top">
                <div className="demo-avatar" style={{ "--demo-color": demo.color }}>
                  {demo.artista.charAt(0)}
                </div>

                <div className="demo-artista">
                  <button type="button" onClick={() => abrirArtista(demo)}>
                    {demo.artista}
                  </button>
                  <span>{demo.seguidores.toLocaleString("es-AR")} seguidores</span>
                </div>

                <div className="demo-track">
                  <strong>{demo.tema}</strong>
                  <span>0:00 / 0:15</span>
                </div>

                <button
                  className="demo-play"
                  type="button"
                  aria-label={`Reproducir ${demo.tema}`}
                  onClick={() =>
                    setDemoActiva((activa) => (activa === demo.id ? null : demo.id))
                  }
                >
                  {demoActiva === demo.id ? (
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                      <path d="M560-200v-560h160v560H560Zm-320 0v-560h160v560H240Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" height="27px" viewBox="0 -960 960 960" width="27px" fill="currentColor">
                      <path d="M320-200v-560l440 280-440 280Z" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="demo-bio">
                <strong>BIO:</strong>
                <p>{demo.bio}</p>
              </div>
            </div>

            <div className="demo-actions" aria-label={`Acciones de ${demo.artista}`}>
              <button
                className={demo.liked ? "activo" : ""}
                type="button"
                aria-label={demo.liked ? "Quitar like" : "Dar like"}
                onClick={() => actualizarDemo(demo.id, "liked")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="26px" viewBox="0 -960 960 960" width="26px" fill="currentColor">
                  <path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z" />
                </svg>
              </button>

              <button
                className={demo.guardado ? "activo" : ""}
                type="button"
                aria-label={demo.guardado ? "Quitar de guardados" : "Guardar demo"}
                onClick={() => actualizarDemo(demo.id, "guardado")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="28px" viewBox="0 -960 960 960" width="28px" fill="currentColor">
                  <path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Z" />
                </svg>
              </button>

              <button
                className={demo.siguiendo ? "activo" : ""}
                type="button"
                aria-label={demo.siguiendo ? "Dejar de seguir artista" : "Seguir artista"}
                onClick={() => actualizarDemo(demo.id, "siguiendo")}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="currentColor">
                  <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                </svg>
              </button>
            </div>
          </article>
        ))}
      </div>

      {demosFiltradas.length === 0 ? (
        <p className="descubrir-vacio">No encontramos demos para esa busqueda.</p>
      ) : null}
    </section>
  );
}
