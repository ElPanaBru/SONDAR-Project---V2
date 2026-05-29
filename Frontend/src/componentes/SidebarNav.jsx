import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { api } from "../api";
import "./sidebarNav.css";

const iconos = {
  eventos:
    "M509-269q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  demos:
    "m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
  comunidad:
    "M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Z",
  publicar:
    "M440-280h80v-80h-80v80Zm-160 40h400v-80H280v80Zm160 120h80v-80h-80v80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Z",
  cerrar:
    "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
};

function Icono({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="24" height="24" fill="currentColor">
      <path d={iconos[nombre]} />
    </svg>
  );
}

const archivoComoDataUrl = (file) =>
  new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result || "");
    reader.readAsDataURL(file);
  });

const fechaISO = (fecha, hora) => {
  if (!fecha || !hora) return "";
  return new Date(`${fecha}T${hora}`).toISOString();
};

const slugify = (texto) =>
  String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function SidebarNav({ usuario }) {
  const [open, setOpen] = useState(false);
  const [crearMenuOpen, setCrearMenuOpen] = useState(false);
  const [modalActivo, setModalActivo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [evento, setEvento] = useState({
    titulo: "",
    genero: "otros",
    lugar: "",
    fecha: "",
    hora: "",
    link: "",
    imagen: null,
  });
  const [demo, setDemo] = useState({
    artista: "",
    tema: "",
    album: "",
    descripcion: "",
    duracion: "",
  });
  const [comunidad, setComunidad] = useState({
    titulo: "",
    categoria: "",
    descripcion: "",
  });
  const [publicacion, setPublicacion] = useState({
    nombre: "",
    audio: null,
    miniatura: null,
  });

  const sections = useMemo(
    () => [
      {
        key: "ir-a",
        label: "Ir a...",
        items: [
          { to: "/", label: "Eventos", end: true, icon: "eventos" },
          { to: "/descubrir", label: "Demos", end: false, icon: "demos" },
          { to: "/comunidad", label: "Comunidad", end: false, icon: "comunidad" },
        ],
      },
    ],
    []
  );

  const crearItems = [
    { key: "evento", label: "Evento", icon: "eventos" },
    { key: "demo", label: "Demo", icon: "demos" },
    { key: "comunidad", label: "Comunidad", icon: "comunidad" },
    { key: "publicacion", label: "Publicacion", icon: "publicar" },
  ];

  const abrirModal = (tipo) => {
    setMensaje("");
    setCrearMenuOpen(false);
    setModalActivo(tipo);
  };

  const cerrarModal = () => {
    if (guardando) return;
    setModalActivo(null);
    setMensaje("");
  };

  const asegurarSesion = () => {
    if (usuario?.uid) return true;
    setMensaje("Inicia sesion para crear contenido.");
    return false;
  };

  const guardarEvento = async (event) => {
    event.preventDefault();
    if (!asegurarSesion()) return;

    setGuardando(true);
    try {
      const imagen = await archivoComoDataUrl(evento.imagen);
      await api.crearEvento({
        titulo: evento.titulo,
        lugar: evento.lugar,
        fecha: fechaISO(evento.fecha, evento.hora),
        genero: evento.genero || "otros",
        coords: [-34.6037, -58.3816],
        img: imagen || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
        link: evento.link,
        createdBy: usuario.uid,
        creador: usuario.email || "Anonimo",
      });
      setEvento({ titulo: "", genero: "otros", lugar: "", fecha: "", hora: "", link: "", imagen: null });
      setMensaje("Evento creado.");
      setModalActivo(null);
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudo crear el evento.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarDemo = async (event) => {
    event.preventDefault();
    if (!asegurarSesion()) return;

    setGuardando(true);
    try {
      const existente = await api.obtenerCatalogo("demos_creados").catch(() => []);
      const item = {
        id: Date.now(),
        artista: demo.artista,
        usuario: `@${slugify(demo.artista).replaceAll("-", "") || "artista"}`,
        tema: demo.tema,
        album: demo.album,
        descripcion: demo.descripcion,
        duracion: demo.duracion || "0:00",
        progreso: 0,
        colorA: "#ffae00",
        colorB: "#ff5e00",
        colorC: "#101010",
        createdBy: usuario.uid,
      };

      await api.guardarCatalogo("demos_creados", [item, ...existente]);
      setDemo({ artista: "", tema: "", album: "", descripcion: "", duracion: "" });
      setMensaje("Demo creada.");
      setModalActivo(null);
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudo crear la demo.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarComunidad = async (event) => {
    event.preventDefault();
    if (!asegurarSesion()) return;

    setGuardando(true);
    try {
      const existente = await api.obtenerCatalogo("comunidades_creadas").catch(() => []);
      const item = {
        id: slugify(comunidad.titulo) || String(Date.now()),
        nombre: `r/${slugify(comunidad.titulo) || "comunidad"}`,
        titulo: comunidad.titulo,
        descripcion: comunidad.descripcion,
        categoria: comunidad.categoria || "general",
        miembros: "1",
        actividad: "nueva",
        createdBy: usuario.uid,
      };

      await api.guardarCatalogo("comunidades_creadas", [item, ...existente]);
      setComunidad({ titulo: "", categoria: "", descripcion: "" });
      setMensaje("Comunidad creada.");
      setModalActivo(null);
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudo crear la comunidad.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarPublicacion = async (event) => {
    event.preventDefault();
    if (!asegurarSesion()) return;

    setGuardando(true);
    try {
      const miniatura = await archivoComoDataUrl(publicacion.miniatura);
      await api.crearPublicacion(usuario.uid, {
        nombre: publicacion.nombre,
        audioName: publicacion.audio?.name || "",
        miniatura,
      });
      setPublicacion({ nombre: "", audio: null, miniatura: null });
      setMensaje("Publicacion creada.");
      setModalActivo(null);
    } catch (error) {
      console.error(error);
      setMensaje(error.message || "No se pudo crear la publicacion.");
    } finally {
      setGuardando(false);
    }
  };

  const renderModal = () => {
    if (!modalActivo) return null;

    const titulos = {
      evento: "Crear evento",
      demo: "Crear demo",
      comunidad: "Crear comunidad",
      publicacion: "Crear publicacion",
    };

    return (
      <div className="sidebar-modal-overlay" role="presentation" onMouseDown={cerrarModal}>
        <section
          className="sidebar-modal"
          role="dialog"
          aria-modal="true"
          aria-label={titulos[modalActivo]}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header className="sidebar-modal-header">
            <div>
              <span>SONDAR</span>
              <h2>{titulos[modalActivo]}</h2>
            </div>
            <button type="button" onClick={cerrarModal} aria-label="Cerrar">
              <Icono nombre="cerrar" />
            </button>
          </header>

          {modalActivo === "evento" && (
            <form className="sidebar-form" onSubmit={guardarEvento}>
              <input value={evento.titulo} onChange={(e) => setEvento({ ...evento, titulo: e.target.value })} placeholder="Nombre del evento" required />
              <input value={evento.lugar} onChange={(e) => setEvento({ ...evento, lugar: e.target.value })} placeholder="Lugar" required />
              <select value={evento.genero} onChange={(e) => setEvento({ ...evento, genero: e.target.value })}>
                <option value="pop">Pop</option>
                <option value="rock">Rock</option>
                <option value="edm">EDM</option>
                <option value="jazz">Jazz</option>
                <option value="trap">Trap</option>
                <option value="otros">Otros</option>
              </select>
              <div className="sidebar-form-grid">
                <input type="date" value={evento.fecha} onChange={(e) => setEvento({ ...evento, fecha: e.target.value })} required />
                <input type="time" value={evento.hora} onChange={(e) => setEvento({ ...evento, hora: e.target.value })} required />
              </div>
              <input type="url" value={evento.link} onChange={(e) => setEvento({ ...evento, link: e.target.value })} placeholder="Link de entradas" />
              <label className="sidebar-file">
                Imagen
                <input type="file" accept="image/*" onChange={(e) => setEvento({ ...evento, imagen: e.target.files?.[0] || null })} />
              </label>
              <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Crear evento"}</button>
            </form>
          )}

          {modalActivo === "demo" && (
            <form className="sidebar-form" onSubmit={guardarDemo}>
              <input value={demo.artista} onChange={(e) => setDemo({ ...demo, artista: e.target.value })} placeholder="Artista" required />
              <input value={demo.tema} onChange={(e) => setDemo({ ...demo, tema: e.target.value })} placeholder="Nombre del tema" required />
              <input value={demo.album} onChange={(e) => setDemo({ ...demo, album: e.target.value })} placeholder="Album o proyecto" required />
              <input value={demo.duracion} onChange={(e) => setDemo({ ...demo, duracion: e.target.value })} placeholder="Duracion, ej: 3:42" />
              <textarea value={demo.descripcion} onChange={(e) => setDemo({ ...demo, descripcion: e.target.value })} placeholder="Descripcion" rows="4" required />
              <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Crear demo"}</button>
            </form>
          )}

          {modalActivo === "comunidad" && (
            <form className="sidebar-form" onSubmit={guardarComunidad}>
              <input value={comunidad.titulo} onChange={(e) => setComunidad({ ...comunidad, titulo: e.target.value })} placeholder="Nombre de la comunidad" required />
              <input value={comunidad.categoria} onChange={(e) => setComunidad({ ...comunidad, categoria: e.target.value })} placeholder="Categoria" />
              <textarea value={comunidad.descripcion} onChange={(e) => setComunidad({ ...comunidad, descripcion: e.target.value })} placeholder="Descripcion" rows="4" required />
              <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Crear comunidad"}</button>
            </form>
          )}

          {modalActivo === "publicacion" && (
            <form className="sidebar-form" onSubmit={guardarPublicacion}>
              <input value={publicacion.nombre} onChange={(e) => setPublicacion({ ...publicacion, nombre: e.target.value })} placeholder="Nombre de la cancion" required />
              <label className="sidebar-file">
                Audio
                <input type="file" accept="audio/*" onChange={(e) => setPublicacion({ ...publicacion, audio: e.target.files?.[0] || null })} required />
              </label>
              <label className="sidebar-file">
                Miniatura
                <input type="file" accept="image/*" onChange={(e) => setPublicacion({ ...publicacion, miniatura: e.target.files?.[0] || null })} required />
              </label>
              <button type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Crear publicacion"}</button>
            </form>
          )}

          {mensaje ? <p className="sidebar-modal-msg">{mensaje}</p> : null}
        </section>
      </div>
    );
  };

  return (
    <>
      <aside className={`sidebar-nav ${open ? "open" : ""}`} aria-label="Navegacion">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Cerrar sidebar" : "Abrir sidebar"}
        >
          <span className="sidebar-toggle-icon" aria-hidden="true">=</span>
        </button>

        <div className="sidebar-content" role="navigation">
          {sections.map((section) => (
            <div key={section.key} className="sidebar-section">
              <div className="sidebar-section-title">{section.label}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link sidebar-sub-link ${isActive ? "active" : ""}`}
                >
                  <span className="sidebar-link-icon" aria-hidden="true"><Icono nombre={item.icon} /></span>
                  <span className="sidebar-link-text">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="sidebar-section sidebar-create-section">
            <div className="sidebar-section-title">Crear</div>
            <div className="sidebar-create-menu-wrap">
              <button
                type="button"
                className={`sidebar-link sidebar-create-button ${crearMenuOpen ? "menu-open" : ""}`}
                onClick={() => setCrearMenuOpen((value) => !value)}
                aria-expanded={crearMenuOpen}
                aria-haspopup="menu"
              >
                <span className="sidebar-link-icon" aria-hidden="true"><Icono nombre="publicar" /></span>
                <span className="sidebar-link-text">Crear</span>
              </button>
              {crearMenuOpen && (
                <div className="sidebar-create-popover" role="menu" aria-label="Opciones para crear">
                  {crearItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      className="sidebar-create-option"
                      onClick={() => abrirModal(item.key)}
                    >
                      <span aria-hidden="true"><Icono nombre={item.icon} /></span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {renderModal()}
    </>
  );
}
