import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import "./navbar.css";
import NotificationPanel from "./NotificationPanel";
import { usePreferencias } from "../hooks/usePreferencias";

const iconosCrear = {
  evento:
    "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  demo:
    "m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
};

function IconoCrear({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="18" height="18" fill="currentColor">
      <path d={iconosCrear[nombre]} />
    </svg>
  );
}

const perfilGuardado = (usuario) => {
  return {
    nombre: usuario?.user_metadata?.name || usuario?.email?.split("@")[0] || "Usuario SONDAR",
    bio: "Musica, comunidad y nuevas canciones.",
    avatar: "",
  };
};

function Navbar({ usuario }) {
  const { preferencias, t } = usePreferencias();
  const [busqueda, setBusqueda] = useState("");
  const [mostrarNotifs, setMostrarNotifs] = useState(false);
  const [notificacionesNoLeidas, setNotificacionesNoLeidas] = useState(0);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarEditor, setMostrarEditor] = useState(false);
  const [perfilEditado, setPerfilEditado] = useState(() => perfilGuardado(usuario));
  const [avatarArchivo, setAvatarArchivo] = useState(null);
  const crearRef = useRef(null);
  const notificacionesRef = useRef(null);
  const perfilRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const avatarPreview = perfilEditado.avatar;
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [perfilEditado.avatar]);

  useEffect(() => {
    const actualizarPerfil = (event) => {
      setPerfilEditado(event.detail || perfilGuardado(usuario));
    };
    window.addEventListener("sondar-perfil-actualizado", actualizarPerfil);
    return () => window.removeEventListener("sondar-perfil-actualizado", actualizarPerfil);
  }, [usuario]);

  useEffect(() => {
    if (!usuario) {
      return undefined;
    }
    if (!preferencias.actividadCuenta) {
      return undefined;
    }

    let activo = true;
    const cargarContador = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await apiRequest("/api/notificaciones/no-leidas", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const dataContador = await response.json();
        if (activo) setNotificacionesNoLeidas(Number(dataContador.noLeidas || 0));
      } catch (error) {
        console.error("Error al cargar contador de notificaciones:", error);
      }
    };

    const recibirActualizacion = (event) => {
      if (typeof event.detail?.noLeidas === "number") {
        setNotificacionesNoLeidas(event.detail.noLeidas);
      } else {
        cargarContador();
      }
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") cargarContador();
    };

    cargarContador();
    const intervalo = window.setInterval(cargarContador, 30000);
    window.addEventListener("sondar:notificaciones-actualizadas", recibirActualizacion);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      activo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("sondar:notificaciones-actualizadas", recibirActualizacion);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [preferencias.actividadCuenta, usuario]);

  useEffect(() => {
    let activo = true;

    const cargarPerfil = async () => {
      if (!usuario) {
        setPerfilEditado(perfilGuardado(null));
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (activo) setPerfilEditado(perfilGuardado(usuario));
          return;
        }

        const response = await apiRequest("/api/usuarios/me/perfil", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (activo) setPerfilEditado(perfilGuardado(usuario));
          return;
        }

        const dataPerfil = await response.json();
        if (activo) setPerfilEditado(dataPerfil.perfil || perfilGuardado(usuario));
      } catch (error) {
        console.error("Error al cargar perfil en navbar:", error);
        if (activo) setPerfilEditado(perfilGuardado(usuario));
      }
    };

    cargarPerfil();
    return () => {
      activo = false;
    };
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
    const query = busqueda.trim();

    if (!query) return;

    setMostrarCrear(false);
    setMostrarNotifs(false);
    setMostrarPerfil(false);

    navigate(`/buscar?query=${encodeURIComponent(query)}`);
  };

  const getPlaceholder = () => {
    return t("Buscar usuarios, reels o eventos...");
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

  const handlePerfilChange = (e) => {
    setPerfilEditado({
      ...perfilEditado,
      [e.target.name]: e.target.value,
    });
  };

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarArchivo(file);
    setPerfilEditado((prev) => ({
      ...prev,
      avatar: URL.createObjectURL(file),
    }));
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const formData = new FormData();
      formData.append("nombre", perfilEditado.nombre);
      formData.append("bio", perfilEditado.bio || "");
      if (avatarArchivo) formData.append("avatar", avatarArchivo);

      const response = await apiRequest("/api/usuarios/me/perfil", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) return;

      const perfilGuardadoBackend = await response.json();
      setPerfilEditado(perfilGuardadoBackend);
      setAvatarArchivo(null);
      window.dispatchEvent(new CustomEvent("sondar-perfil-actualizado", { detail: perfilGuardadoBackend }));
      setMostrarEditor(false);
    } catch (error) {
      console.error("Error al guardar perfil en navbar:", error);
    }
  };

  const crearDesdeNavbar = (tipo) => {
    setMostrarCrear(false);

    if (tipo === "evento") {
      navigate("/?crear=evento");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sondar:crear-evento"));
      }, 0);
      return;
    }

    if (tipo === "demo") {
      navigate("/descubrir?crear=reel");
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("sondar:crear-reel"));
      }, 0);
      return;
    }
  };

  const inicialPerfil = (perfilEditado.nombre || usuario?.email || "S").charAt(0).toUpperCase();
  const notificacionesVisibles = preferencias.actividadCuenta ? notificacionesNoLeidas : 0;

  return (
    <>
      <nav className="custom-navbar">
        <Link to="/" className="navbar-brand">
          <img src="/sondar-logo.png?v=7" alt="SONDAR" className="logo" />
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
                {t("Iniciar sesión")}
              </Link>
              <Link className="auth-link auth-register" to="/auth?modo=registro">
                {t("Crear cuenta")}
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
                  {t("Crear")}
                </button>
                {mostrarCrear ? (
                  <div className="navbar-create-menu" role="menu" aria-label="Opciones para crear">
                    <button type="button" role="menuitem" onClick={() => crearDesdeNavbar("evento")}><IconoCrear nombre="evento" />{t("Evento")}</button>
                    <button type="button" role="menuitem" onClick={() => crearDesdeNavbar("demo")}><IconoCrear nombre="demo" />Reel</button>
                  </div>
                ) : null}
              </div>

              <div className="navbar-notifications-wrap" ref={notificacionesRef}>
                <button
                  className={`inbox-button inbox-button--notifs ${mostrarNotifs ? "active" : ""} ${!preferencias.actividadCuenta ? "notifications-paused" : ""}`}
                  type="button"
                  onClick={() => {
                    setMostrarCrear(false);
                    setMostrarPerfil(false);
                    setMostrarNotifs((value) => !value);
                  }}
                  aria-label={`${t("Notificaciones")}${!preferencias.actividadCuenta ? ": pausadas" : notificacionesVisibles ? `, ${notificacionesVisibles} sin leer` : ""}`}
                  aria-expanded={mostrarNotifs}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                    <path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320 120q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z" />
                  </svg>
                  {notificacionesVisibles > 0 ? (
                    <span className="navbar-notification-badge" aria-hidden="true">
                      {notificacionesVisibles > 99 ? "99+" : notificacionesVisibles}
                    </span>
                  ) : null}
                </button>
                {mostrarNotifs ? (
                  <NotificationPanel
                    usuario={usuario}
                    onClose={() => setMostrarNotifs(false)}
                    onCountChange={setNotificacionesNoLeidas}
                  />
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
                        {t("Mi perfil")}
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/soporte" onClick={() => setMostrarPerfil(false)}>
                        {t("Soporte")}
                      </Link>
                    </li>
                    <li>
                      <Link className="dropdown-item" to="/configuracion" onClick={() => setMostrarPerfil(false)}>
                        {t("Configuración")}
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    <li>
                      <button className="dropdown-item" type="button" onClick={handleLogout}>
                        {t("Cerrar sesión")}
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
