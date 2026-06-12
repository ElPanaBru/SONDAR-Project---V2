import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./navbar.css";
import NotificationPanel from "./NotificationPanel";
import ChatPrivatePanel from "./ChatPrivatePanel";

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
  const [mostrarChat, setMostrarChat] = useState(false);
  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [perfilEditado, setPerfilEditado] = useState(() => perfilGuardado(usuario));
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();
    const ruta = location.pathname;
    const query = busqueda.trim();

    if (!query) return;

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
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error al cerrar sesion:", error);
    }
  };

  const abrirEditor = () => {
    setPerfilEditado(perfilGuardado(usuario));
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
              <button
                className="inbox-button inbox-button--chat"
                type="button"
                onClick={() => setMostrarChat(true)}
                aria-label="Bandeja de entrada"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                  <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-120H640q-30 38-71.5 59T480-240q-47 0-88.5-21T320-320H200v120Zm349-142q31-22 43-58h168v-360H200v360h168q12 36 43 58t69 22q38 0 69-22Z" />
                </svg>
              </button>

              <button
                className="inbox-button inbox-button--notifs"
                type="button"
                onClick={() => setMostrarNotifs(true)}
                aria-label="Notificaciones"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                  <path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320 120q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z" />
                </svg>
              </button>

              <Link className="profile-button profile-link-button" to="/perfil">
                <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="currentColor">
                  <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-204q-59 0-99.5-40.5T340-620q0-59 40.5-99.5T480-760q59 0 99.5 40.5T620-620q0 59-40.5 99.5T480-480Zm0 400q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                </svg>
                Mi perfil
              </Link>

              <button
                className="profile-button account-menu-button dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label="Abrir menu de cuenta"
              >
                <span className="account-menu-lines" aria-hidden="true">=</span>
              </button>

              <ul className="dropdown-menu dropdown-menu-end profile-dropdown">
                <li>
                  <button className="dropdown-item" type="button" onClick={abrirEditor}>
                    Editar perfil
                  </button>
                </li>
                <li>
                  <Link className="dropdown-item" to="/soporte">
                    Soporte
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/configuracion">
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
            </div>
          )}
        </div>
      </nav>

      {usuario && mostrarNotifs ? (
        <NotificationPanel usuario={usuario} onClose={() => setMostrarNotifs(false)} />
      ) : null}

      {usuario && mostrarChat ? (
        <ChatPrivatePanel usuario={usuario} onClose={() => setMostrarChat(false)} />
      ) : null}

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
