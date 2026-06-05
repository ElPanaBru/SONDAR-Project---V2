import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./navbar.css";

function Navbar({ usuario }) {
  const [busqueda, setBusqueda] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();
    const ruta = location.pathname;
    const query = busqueda.trim();

    if (!query) return;

    if (ruta === "/mapa") {
      navigate(`/mapa?bares=${query}`);
    } else if (ruta === "/comunidad") {
      navigate(`/comunidad?comunidad=${query}`);
    } else {
      navigate(`/descubrir?query=${query}`);
    }
  };

  const getPlaceholder = () => {
    const ruta = location.pathname;
    if (ruta === "/mapa") return "Buscar bares...";
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

  return (
    <nav className="custom-navbar">
      <Link to="/" className="navbar-brand">
        <img src="/logo.png" alt="SONDAR" className="logo" />
      </Link>

      <div className="navbar-center">
        <NavLink to="/" end className="nav-link nav-home" title="Eventos">
          Eventos
        </NavLink>

        <NavLink to="/descubrir" className="nav-link">
          Descubrir
        </NavLink>

        <NavLink to="/comunidad" className="nav-link">
          Comunidad
        </NavLink>

      </div>

      <div className="navbar-actions">
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
              className="profile-button dropdown-toggle"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="currentColor">
                <path d="M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-204q-59 0-99.5-40.5T340-620q0-59 40.5-99.5T480-760q59 0 99.5 40.5T620-620q0 59-40.5 99.5T480-480Zm0 400q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
              </svg>
              Mi perfil
            </button>

            <ul className="dropdown-menu dropdown-menu-end profile-dropdown">
              <li>
                <Link className="dropdown-item" to="/perfil">
                  Editar perfil
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" to="/configuracion">
                  Configuracion
                </Link>
              </li>
              <li>
                <Link className="dropdown-item" to="/soporte">
                  Soporte
                </Link>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Cerrar sesion
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
