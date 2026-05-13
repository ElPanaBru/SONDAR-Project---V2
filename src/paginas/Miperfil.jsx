import { useState } from "react";
import "./miperfil.css";

export default function MiPerfil({ usuario }) {
  const [editando, setEditando] = useState(false);
  const [tabActiva, setTabActiva] = useState("publicaciones");
  const [perfil, setPerfil] = useState({
    nombre: usuario?.displayName || usuario?.email?.split("@")[0] || "nombreUsuario",
    bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    avatar: "",
  });
  const [perfilEditado, setPerfilEditado] = useState(perfil);
  const [creandoPublicacion, setCreandoPublicacion] = useState(false);
  const [publicaciones, setPublicaciones] = useState([]);
  const [publicacionNueva, setPublicacionNueva] = useState({
    nombre: "",
    audio: null,
    miniatura: "",
  });

  const inicial = perfil.nombre.trim().charAt(0).toUpperCase() || "S";
  const opcionesPerfil = [
    {
      id: "publicaciones",
      label: "Publicaciones",
      mensaje: "Aun no hay publicaciones.",
    },
    {
      id: "eventos",
      label: "Eventos",
      mensaje: "Aun no hay eventos.",
    },
    {
      id: "favoritos",
      label: "Favoritos",
      mensaje: "Aun no hay favoritos.",
    },
    {
      id: "guardados",
      label: "Guardados",
      mensaje: "Aun no hay guardados.",
    },
  ];
  const contenidoActivo = opcionesPerfil.find((opcion) => opcion.id === tabActiva);

  const abrirEditor = () => {
    setPerfilEditado(perfil);
    setEditando(true);
  };

  const cerrarEditor = () => {
    setPerfilEditado(perfil);
    setEditando(false);
  };

  const cerrarPublicacion = () => {
    setCreandoPublicacion(false);
    setPublicacionNueva({
      nombre: "",
      audio: null,
      miniatura: "",
    });
  };

  const handleChange = (e) => {
    setPerfilEditado({
      ...perfilEditado,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatar = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPerfilEditado((prev) => ({
        ...prev,
        avatar: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handlePublicacionChange = (e) => {
    setPublicacionNueva({
      ...publicacionNueva,
      [e.target.name]: e.target.value,
    });
  };

  const handleAudio = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPublicacionNueva((prev) => ({
      ...prev,
      audio: file,
    }));
  };

  const handleMiniatura = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPublicacionNueva((prev) => ({
        ...prev,
        miniatura: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const guardarPublicacion = (e) => {
    e.preventDefault();

    setPublicaciones((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ...publicacionNueva,
      },
    ]);
    cerrarPublicacion();
  };

  const renderContenidoActivo = () => {
    if (tabActiva === "publicaciones") {
      return (
        <div className="perfil-publicaciones-grid">
          <button
            className="perfil-publicacion-add"
            type="button"
            onClick={() => setCreandoPublicacion(true)}
            aria-label="Subir publicacion"
          >
            +
          </button>

          {publicaciones.map((publicacion) => (
            <article className="perfil-publicacion-card" key={publicacion.id}>
              <div className="perfil-publicacion-img">
                {publicacion.miniatura ? (
                  <img src={publicacion.miniatura} alt={publicacion.nombre} />
                ) : (
                  <span>{publicacion.nombre.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <h3>{publicacion.nombre}</h3>
              {publicacion.audio ? <p>{publicacion.audio.name}</p> : null}
            </article>
          ))}
        </div>
      );
    }

    return <p>{contenidoActivo?.mensaje}</p>;
  };

  return (
    <section className="perfil-page">
      <div className="perfil-card">
        <div className="perfil-avatar-zone">
          <div className="perfil-avatar">
            {perfil.avatar ? (
              <img src={perfil.avatar} alt={perfil.nombre} />
            ) : (
              <span>{inicial}</span>
            )}
          </div>

          <button className="perfil-primary-btn" type="button">
            Seguir
          </button>
        </div>

        <div className="perfil-info">
          <div className="perfil-title-row">
            <h1>{perfil.nombre}</h1>
            <button
              className="perfil-edit-btn"
              type="button"
              onClick={abrirEditor}
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
            </button>
          </div>

          <div className="perfil-stats">
            <p>0 Seguidores</p>
            <p>0 Seguidos</p>
          </div>

          <p className="perfil-bio">"{perfil.bio}"</p>
        </div>
      </div>

      {editando ? (
        <div className="perfil-modal-overlay" role="dialog" aria-modal="true">
          <form
            className="perfil-modal"
            onSubmit={(e) => {
              e.preventDefault();
              setPerfil(perfilEditado);
              setEditando(false);
            }}
          >
            <div className="perfil-modal-header">
              <h2>Editar perfil</h2>
              <button
                className="perfil-modal-close"
                type="button"
                onClick={cerrarEditor}
                aria-label="Cerrar editor"
              >
                x
              </button>
            </div>

            <div className="perfil-modal-body">
              <div className="perfil-modal-avatar">
                <div className="perfil-avatar">
                  {perfilEditado.avatar ? (
                    <img src={perfilEditado.avatar} alt={perfilEditado.nombre} />
                  ) : (
                    <span>
                      {perfilEditado.nombre.trim().charAt(0).toUpperCase() || "S"}
                    </span>
                  )}
                </div>

                <label className="perfil-avatar-upload">
                  Cambiar foto
                  <input type="file" accept="image/*" onChange={handleAvatar} />
                </label>
              </div>

              <div className="perfil-form">
                <label>
                  Nombre de usuario
                  <input
                    type="text"
                    name="nombre"
                    value={perfilEditado.nombre}
                    onChange={handleChange}
                    maxLength="32"
                    required
                  />
                </label>

                <label>
                  Descripcion
                  <textarea
                    name="bio"
                    value={perfilEditado.bio}
                    onChange={handleChange}
                    rows="6"
                    maxLength="180"
                  />
                </label>

                <div className="perfil-form-actions">
                  <button type="submit">Guardar</button>
                  <button type="button" onClick={cerrarEditor}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {creandoPublicacion ? (
        <div className="perfil-modal-overlay" role="dialog" aria-modal="true">
          <form className="perfil-modal perfil-publicacion-modal" onSubmit={guardarPublicacion}>
            <div className="perfil-modal-header">
              <h2>Nueva publicacion</h2>
              <button
                className="perfil-modal-close"
                type="button"
                onClick={cerrarPublicacion}
                aria-label="Cerrar publicacion"
              >
                x
              </button>
            </div>

            <div className="perfil-publicacion-form">
              <label>
                Nombre de la cancion
                <input
                  type="text"
                  name="nombre"
                  value={publicacionNueva.nombre}
                  onChange={handlePublicacionChange}
                  maxLength="48"
                  required
                />
              </label>

              <label>
                Archivo de audio
                <input type="file" onChange={handleAudio} required />
              </label>

              <label>
                Miniatura
                <input type="file" accept="image/*" onChange={handleMiniatura} required />
              </label>

              {publicacionNueva.miniatura ? (
                <div className="perfil-miniatura-preview">
                  <img src={publicacionNueva.miniatura} alt="Miniatura seleccionada" />
                </div>
              ) : null}

              <div className="perfil-form-actions">
                <button type="submit">Publicar</button>
                <button type="button" onClick={cerrarPublicacion}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <div className="perfil-tabs">
        {opcionesPerfil.map((opcion) => (
          <button
            key={opcion.id}
            className={tabActiva === opcion.id ? "active" : ""}
            type="button"
            onClick={() => setTabActiva(opcion.id)}
          >
            {opcion.label}
          </button>
        ))}
      </div>

      <div className="perfil-tab-content">
        {renderContenidoActivo()}
      </div>
    </section>
  );
}
