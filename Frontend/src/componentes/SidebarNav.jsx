import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import PerfilSocialModal from "./PerfilSocialModal";
import "./sidebarNav.css";

const iconos = {
  eventos:
    "M509-269q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  descubrir:
    "m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
  mensajes:
    "M160-160v-560q0-33 23.5-56.5T240-800h480q33 0 56.5 23.5T800-720v360q0 33-23.5 56.5T720-280H320L160-160Zm114-200h446v-360H240v365l34-5Z",
};

function Icono({ nombre }) {
  if (nombre === "comunidad") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 96 96"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="48" cy="27" r="16" />
        <circle cx="21.5" cy="37" r="11.5" />
        <circle cx="74.5" cy="37" r="11.5" />
        <path d="M28 77v-7c0-14 8.9-24 20-24s20 10 20 24v7" />
        <path d="M7 69v-5c0-11 6.4-19 14.5-19 6.1 0 11.3 4.1 13.5 10.4" />
        <path d="M89 69v-5c0-11-6.4-19-14.5-19-6.1 0-11.3 4.1-13.5 10.4" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="24" height="24" fill="currentColor">
      <path d={iconos[nombre]} />
    </svg>
  );
}

const links = [
  { to: "/", label: "Eventos", icon: "eventos", end: true },
  { to: "/descubrir", label: "Descubrir", icon: "descubrir" },
  { to: "/comunidad", label: "Foros", icon: "comunidad" },
  { to: "/mensajes", label: "Mensajes", icon: "mensajes" },
];

export default function SidebarNav({ usuario }) {
  const { t } = usePreferencias();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [seguidos, setSeguidos] = useState([]);
  const [listaSeguidosAbierta, setListaSeguidosAbierta] = useState(false);

  useEffect(() => {
    let activo = true;

    const cargarSeguidos = async () => {
      if (!usuario) {
        setSeguidos([]);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const response = await apiRequest("/api/usuarios/me/seguidos", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;
        const dataSeguidos = await response.json();
        if (activo) setSeguidos(dataSeguidos);
      } catch (error) {
        console.error("No se pudieron cargar los seguidos:", error);
      }
    };

    cargarSeguidos();
    window.addEventListener("sondar:seguimiento-actualizado", cargarSeguidos);
    return () => {
      activo = false;
      window.removeEventListener("sondar:seguimiento-actualizado", cargarSeguidos);
    };
  }, [usuario]);

  const abrirPerfilSeguido = (perfil) => {
    setListaSeguidosAbierta(false);
    if (!perfil?.id) return;
    navigate(perfil.id === usuario?.id ? "/perfil" : `/perfil/${perfil.id}`);
  };

  return (
    <aside className={`sidebar-nav ${open ? "open" : ""}`} aria-label="Navegación principal">
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Cerrar barra lateral" : "Abrir barra lateral"}
      >
        <span className="sidebar-toggle-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      <div className="sidebar-content" role="navigation">
        <div className="sidebar-section">
          <div className="sidebar-section-title">{t("Ir a...")}</div>
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link sidebar-main-link ${isActive ? "active" : ""}`}
            >
              <span className="sidebar-link-icon" aria-hidden="true">
                <Icono nombre={item.icon} />
              </span>
              <span className="sidebar-link-text">{t(item.label)}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-section sidebar-following-section">
          <button
            type="button"
            className="sidebar-section-title sidebar-following-title"
            onClick={() => setListaSeguidosAbierta(true)}
            aria-haspopup="dialog"
          >
            {t("Siguiendo")}
          </button>
          {seguidos.map((perfil) => (
            <NavLink
              key={perfil.id}
              to={`/perfil/${perfil.id}`}
              className="sidebar-link sidebar-following-link"
            >
              <span
                className="sidebar-following-avatar"
                style={{ background: "linear-gradient(135deg, #ffae00, #ff5e00)" }}
                aria-hidden="true"
              >
                {perfil.avatar ? <img src={perfil.avatar} alt="" /> : perfil.nombre.charAt(0).toUpperCase()}
              </span>
              <span className="sidebar-link-text">
                <strong>{perfil.nombre}</strong>
                <small>{perfil.usuario}</small>
              </span>
            </NavLink>
          ))}
        </div>
      </div>

      <PerfilSocialModal
        abierto={listaSeguidosAbierta}
        titulo="Seguidos"
        perfiles={seguidos}
        mensajeVacio="Todavia no seguis a nadie."
        onClose={() => setListaSeguidosAbierta(false)}
        onSelect={abrirPerfilSeguido}
      />
    </aside>
  );
}
