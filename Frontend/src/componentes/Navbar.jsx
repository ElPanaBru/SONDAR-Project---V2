import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import "./navbar.css";

function Navbar() {
  const [busqueda, setBusqueda] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();

    const ruta = location.pathname;

    if (ruta === "/mapa") {
      navigate(`/mapa?bares=${busqueda}`);
    } else if (ruta === "/comunidad") {
      navigate(`/comunidad?comunidad=${busqueda}`);
    } else {
      navigate(`/descubrir?query=${busqueda}`);
    }
  };

  const getPlaceholder = () => {
    const ruta = location.pathname;

    if (ruta === "/mapa") return "Buscar bares...";
    if (ruta === "/comunidad") return "Buscar comunidades...";
    return "Buscar artistas o canciones...";
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light custom-navbar">
      <div className="container-fluid">

        {/* Logo */}

        <img src="../favicon.png" alt="Logo" className="logo" />
        {/*<Link className="navbar-brand" to="/inicio">SONDAR</Link>*/}
        <h1>SONDAR</h1>

        {/* Botón mobile */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarColor01"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarColor01">

          {/* 🔍 Buscador */}
          <form className="d-flex search-form" onSubmit={handleSearch}>
            <input
              className="form-control me-2"
              type="search"
              placeholder={getPlaceholder()}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button className="btn btn-secondary" type="submit">
              Buscar
            </button>
          </form>

          {/* 📌 Menú */}
          <ul className="navbar-nav ms-auto">

            <li className="nav-item">
              <Link className="nav-link active" to="/inicio">Inicio</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link active" to="/descubrir">Descubrir</Link>
            </li>

            <li className="nav-item">
              <Link className="nav-link" to="/mapa">Mapa</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/comunidad">Comunidad</Link>
            </li>

            <li className="nav-item dropdown">
              <a
                className="nav-link dropdown-toggle"
                href="#"
                role="button"
                data-bs-toggle="dropdown"
              >
                Mi Perfil
              </a>

              <ul className="dropdown-menu dropdown-menu-end">
                <li><Link className="dropdown-item" to="/perfil">Editar perfil</Link></li>
                <hr/>
                <li><Link className="dropdown-item" to="/biblioteca">Mi biblioteca</Link></li>
                <hr/>
                <li><Link className="dropdown-item" to="/config">Configuración</Link></li>
                <hr/>
                <li><Link className="dropdown-item" to="/soporte">Soporte</Link></li>
                <hr/>
                <li><Link className="dropdown-item" to="/login">Cambiar cuenta</Link></li>
                <hr/>
                <li><Link className="dropdown-item" to="/registro">Cerrar sesion</Link></li>
              </ul>
            </li>

          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;