import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./sidebarNav.css";

const iconos = {
  eventos:
    "M509-269q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  descubrir:
    "m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
  comunidad:
    "M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Z",
  publicar: "M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z",
};

function Icono({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="24" height="24" fill="currentColor">
      <path d={iconos[nombre]} />
    </svg>
  );
}

const links = [
  { to: "/", label: "Eventos", icon: "eventos", end: true },
  { to: "/descubrir", label: "Descubrir", icon: "descubrir" },
  { to: "/comunidad", label: "Comunidad", icon: "comunidad" },
];

const crearItems = [
  { label: "Evento", to: "/", icon: "eventos", action: "crear-evento" },
  { label: "Demo", to: "/descubrir", icon: "descubrir" },
  { label: "Comunidad", to: "/comunidad", icon: "comunidad" },
];

export default function SidebarNav() {
  const [open, setOpen] = useState(false);
  const [crearOpen, setCrearOpen] = useState(false);
  const navigate = useNavigate();

  const irA = (item) => {
    setCrearOpen(false);
    navigate(item.to);

    if (item.action === "crear-evento") {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sondar:crear-evento"));
      }, 0);
    }
  };

  return (
    <aside className={`sidebar-nav ${open ? "open" : ""}`} aria-label="Navegacion principal">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Cerrar barra lateral" : "Abrir barra lateral"}
      >
        <span className="sidebar-toggle-icon" aria-hidden="true">=</span>
      </button>

      <div className="sidebar-content" role="navigation">
        <div className="sidebar-section">
          <div className="sidebar-section-title">Ir a...</div>
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                <Icono nombre={item.icon} />
              </span>
              <span className="sidebar-link-text">{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section sidebar-create-section">
          <div className="sidebar-section-title">Crear</div>
          <div className="sidebar-create-menu-wrap">
            <button
              type="button"
              className={`sidebar-link sidebar-create-button ${crearOpen ? "menu-open" : ""}`}
              onClick={() => setCrearOpen((value) => !value)}
              aria-expanded={crearOpen}
              aria-haspopup="menu"
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                <Icono nombre="publicar" />
              </span>
              <span className="sidebar-link-text">Crear</span>
            </button>

            {crearOpen && (
              <div className="sidebar-create-popover" role="menu" aria-label="Opciones para crear">
                {crearItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className="sidebar-create-option"
                    onClick={() => irA(item)}
                  >
                    <span aria-hidden="true">
                      <Icono nombre={item.icon} />
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
