import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./navbar.css";
import NotificationPanel from "./NotificationPanel";

const iconosCrear = {
  evento:
    "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  demo:
    "m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
  comunidad:
    "M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Z",
};

function IconoCrear({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor">
      <path d={iconosCrear[nombre]} />
    </svg>
  );
}

const perfilGuardado = (usuario) => {
  const fallback = {
    nombre: usuario?.user_metadata?.name || usuario?.email?.split("@")[0] || "Usuario SONDAR",
    bio: "Musica, comunidad y nuevas canciones.",
    avatar: "",
  };

  try {
    const saved = localStorage.getItem("sondar_perfil_local");
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
};

function Navbar({ usuario }) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarNotifs, setMostrarNotifs] = useState(false);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [perfilEditado, setPerfilEditado] = useState(() => perfilGuardado(usuario));
  const crearRef = useRef(null);
  const notificacionesRef = useRef(null);
  const perfilRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const actualizarPerfil = (event) => {
      setPerfilEditado(event.detail || perfilGuardado(usuario));
    };
    window.addEventListener("sondar-perfil-actualizado", actualizarPerfil);
    return () => window.removeEventListener("sondar-perfil-actualizado", actualizarPerfil);
  }, [usuario]);

  useEffect(() => {
    const cerrarAlHacerClickAfuera = (event) => {
      if (!crearRef.current?.contains(event.target)) setMostrarCrear(false);
      if (!notificacionesRef.current?.contains(event.target)) setMostrarNotifs(false);
      if (!perfilRef.current?.contains(event.target)) setMostrarPerfil(false);
    };

    const cerrarConEscape = (event) => {
      if (event.key !== "Escape") return;
      setMostrarCrear(false);
      setMostrarNotifs(false);
      setMostrarPerfil(false);
    };

    document.addEventListener("pointerdown", cerrarAlHacerClickAfuera);
    document.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.removeEventListener("pointerdown", cerrarAlHacerClickAfuera);
      document.removeEventListener("keydown", cerrarConEscape);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const ruta = location.pathname;
    const query = busqueda.trim();

    if (!query) return;

    setMostrarCrear(false);
    setMostrarNotifs(false);
    setMostrarPerfil(false);

    if (ruta === "/comunidad") {
      navigate(`/comunidad?comunidad=${query}`);
    } else {
      navigate(`/descubrir?query=${query}`);
    }
  };

  const getPlaceholder = () => {
    const ruta = location.pathname;
    if (ruta === "/comunidad") return "Buscar comunidades...";
    return "Buscar artistas o canciones...";
  };

  const handleLogout = async () => {
    try {
      setMostrarPerfil(false);
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesion:", error);
    }
  };

  const abrirEditor = () => {
    setPerfilEditado(perfilGuardado(usuario));
    setMostrarPerfil(false);
    setMostrarEditor(true);
  };

  const handlePerfilChange = (e) => {
    setPerfilEditado({
      ...perfilEditado,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPerfilEditado((prev) => ({
        ...prev,
        avatar: reader.result || "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const guardarPerfil = (e) => {
    e.preventDefault();
    localStorage.setItem("sondar_perfil_local", JSON.stringify(perfilEditado));
    window.dispatchEvent(new CustomEvent("sondar-perfil-actualizado", { detail: perfilEditado }));
    setMostrarEditor(false);
  };

  const crearDesdeNavbar = (tipo) => {
    setMostrarCrear(false);

    if (tipo === "evento") {
      navigate("/");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sondar:crear-evento"));
      }, 0);
      return;
    }

    navigate(tipo === "comunidad" ? "/comunidad" : "/descubrir");
  };

  const inicialPerfil = (perfilEditado.nombre || usuario?.email || "S").charAt(0).toUpperCase();

  return (
    <>
      <nav className="custom-navbar">
        <Link to="/" className="navbar-brand">
          <img src="/logo.png" alt="SONDAR" className="logo" />
        </Link>

        <div className="navbar-center">
          <form className="search-form" onSubmit={handleSearch}>
            <input
              className="search-input"
              type="search"
              placeholder={getPlaceholder()}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button className="search-button" type="submit" aria-label="Buscar">
              <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="currentColor">
                <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
              </svg>
            </button>
          </form>
        </div>

        <div className="navbar-actions">
          {!usuario ? (
            <div className="auth-actions">
              <Link className="auth-link auth-login" to="/auth?modo=login">
                Iniciar sesion
              </Link>
              <Link className="auth-link auth-register" to="/auth?modo=registro">
                Crear cuenta
              </Link>
            </div>
          ) : (
            <div className="profile-menu">
              <div className="navbar-create-wrap" ref={crearRef}>
                <button
                  className={`navbar-create-button ${mostrarCrear ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setMostrarNotifs(false);
                    setMostrarPerfil(false);
                    setMostrarCrear((value) => !value);
                  }}
                  aria-expanded={mostrarCrear}
                  aria-haspopup="menu"
                >
                  <span aria-hidden="true">+</span>
                  Crear
                </button>
                {mostrarCrear ? (
                  <div className="navbar-create-menu" role="menu" aria-label="Opciones para crear">
                    <button type="button" role="menuitem" onClick={() => crearDesdeNavbar("evento")}><IconoCrear nombre="evento" />Evento</button>
                    <button type="button" role="menuitem" onClick={() => crearDesdeNavbar("demo")}><IconoCrear nombre="demo" />Demo</button>
                    <button type="button" role="menuitem" onClick={() => crearDesdeNavbar("comunidad")}><IconoCrear nombre="comunidad" />Comunidad</button>
                  </div>
                ) : null}
              </div>

              <div className="navbar-notifications-wrap" ref={notificacionesRef}>
                <button
                  className={`inbox-button inbox-button--notifs ${mostrarNotifs ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setMostrarCrear(false);
                    setMostrarPerfil(false);
                    setMostrarNotifs((value) => !value);
                  }}
                  aria-label="Notificaciones"
                  aria-expanded={mostrarNotifs}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                    <path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320 120q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z" />
                  </svg>
                </button>
                {mostrarNotifs ? (
                  <NotificationPanel usuario={usuario} onClose={() => setMostrarNotifs(false)} />
                ) : null}
              </div>

              <div className="navbar-profile-wrap" ref={perfilRef}>
                <button
                  className="profile-avatar-button"
                  type="button"
                  aria-expanded={mostrarPerfil}
                  aria-haspopup="menu"
                  aria-label="Abrir menu de cuenta"
                  onClick={() => {
                    setMostrarCrear(false);
                    setMostrarNotifs(false);
                    setMostrarPerfil((value) => !value);
                  }}
                >
                  {perfilEditado.avatar ? <img src={perfilEditado.avatar} alt="" /> : <span>{inicialPerfil}</span>}
                </button>

                {mostrarPerfil ? (
                  <ul className="profile-dropdown" role="menu">
                    <li>
                      <Link className="dropdown-item" to="/perfil" onClick={() => setMostrarPerfil(false)}>
                        Mi perfil
                      </Link>
                    </li>
                    <li>
                      <button className="dropdown-item" type="button" onClick={abrirEditor}>
                        Editar perfil
                      </button>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/soporte" onClick={() => setMostrarPerfil(false)}>
                        Soporte
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/configuracion" onClick={() => setMostrarPerfil(false)}>
                        Configuracion
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    <li>
                      <button className="dropdown-item" type="button" onClick={handleLogout}>
                        Cerrar sesion
                      </button>
                    </li>
                  </ul>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </nav>

      {usuario && mostrarEditor ? (
        <div className="panel-overlay" role="presentation" onMouseDown={() => setMostrarEditor(false)}>
          <form
            className="panel profile-edit-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Editar perfil"
            onSubmit={guardarPerfil}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h3>Editar perfil</h3>
              <button className="panel-close" type="button" onClick={() => setMostrarEditor(false)} aria-label="Cerrar">
                x
              </button>
            </div>

            <div className="profile-edit-body">
              <div className="profile-edit-avatar">
                {perfilEditado.avatar ? (
                  <img src={perfilEditado.avatar} alt="" />
                ) : (
                  <span>{perfilEditado.nombre?.charAt(0)?.toUpperCase() || "S"}</span>
                )}
              </div>

              <label className="profile-edit-file">
                Cambiar foto
                <input type="file" accept="image/*" onChange={handleAvatar} />
              </label>

              <label>
                Nombre
                <input
                  name="nombre"
                  value={perfilEditado.nombre}
                  onChange={handlePerfilChange}
                  maxLength="32"
                  required
                />
              </label>

              <label>
                Descripcion
                <textarea
                  name="bio"
                  value={perfilEditado.bio}
                  onChange={handlePerfilChange}
                  rows="4"
                  maxLength="180"
                />
              </label>

              <div className="profile-edit-actions">
                <button type="submit">Guardar</button>
                <button type="button" onClick={() => setMostrarEditor(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export default Navbar;
