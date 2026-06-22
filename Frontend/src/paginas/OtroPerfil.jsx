import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CompartirPerfilModal from "../componentes/CompartirPerfilModal";
import PerfilToast from "../componentes/PerfilToast";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./miperfil.css";
import "./otroperfil.css";

const iconosPerfil = {
  grid: "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-480h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-360h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-200h160v-80H200v80Zm240 0h160v-80H440v80Zm240 0h80v-80h-80v80Z",
  calendar: "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  share: "M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-712L356-548q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Z",
  lock: "M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z",
  bell: "M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320 120q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z",
  bellOff: "m792-56-96-96H160v-80h80v-280q0-22 3-43t10-41L56-792l56-56 736 736-56 56ZM320-232h296L320-528v296Zm400-40-80-80v-160q0-66-47-113t-113-47q-17 0-32.5 3T417-660l-62-62q16-10 32-17.5t33-12.5v-20q0-25 17.5-42.5T480-832q25 0 42.5 17.5T540-772v20q80 20 130 84.5T720-512v240ZM480-32q-33 0-56.5-23.5T400-112h160q0 33-23.5 56.5T480-32Z",
};

const perfilVacio = {
  id: "",
  nombre: "Perfil",
  usuario: "@usuario",
  bio: "Artista en SONDAR.",
  avatar: "",
};

const contenidoVacio = {
  publicaciones: [],
  eventos: [],
  seguidores: [],
  seguidos: [],
  stats: {
    publicaciones: 0,
    seguidores: 0,
    seguidos: 0,
  },
};

function IconoPerfil({ nombre, size = 20 }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width={size} height={size} fill="currentColor">
      <path d={iconosPerfil[nombre]} />
    </svg>
  );
}

function crearPerfilDesdeEstado(artista) {
  if (!artista) return null;

  return {
    id: artista.creadorId || "",
    nombre: artista.artista,
    usuario: artista.usuario,
    bio: artista.descripcion,
    avatar: artista.portada,
  };
}

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor || 0);
}

function destinoContenido(item) {
  if (item.tipo === "evento") return `/?evento=${item.id}`;
  return `/descubrir?lanzamiento=db-${item.id}`;
}

function tarjetaContenido(item, onAbrir) {
  return (
    <article
      className="perfil-publicacion-card"
      key={`${item.tipo}-${item.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onAbrir(item);
      }}
    >
      <div className="perfil-publicacion-img otroperfil-publicacion-img">
        {item.imagen ? (
          <img src={item.imagen} alt={item.nombre} />
        ) : (
          <span>{item.nombre?.charAt(0).toUpperCase() || "S"}</span>
        )}
      </div>
      <h3>{item.nombre}</h3>
      <p>{item.detalle || item.genero || item.tipo}</p>
    </article>
  );
}

export default function OtroPerfil({ usuarioActual }) {
  const { t } = usePreferencias();
  const { usuario: identificador } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const perfilInicial = crearPerfilDesdeEstado(location.state?.artista) || perfilVacio;
  const [perfil, setPerfil] = useState(perfilInicial);
  const [contenido, setContenido] = useState(contenidoVacio);
  const [siguiendo, setSiguiendo] = useState(false);
  const [silenciado, setSilenciado] = useState(false);
  const [tabActiva, setTabActiva] = useState("publicaciones");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [listaSocialActiva, setListaSocialActiva] = useState(null);
  const [compartirAbierto, setCompartirAbierto] = useState(false);

  const opcionesPerfil = useMemo(
    () => [
      { id: "publicaciones", label: t("Publicaciones"), icono: "grid", mensaje: t("Aún no hay publicaciones.") },
      { id: "eventos", label: t("Eventos"), icono: "calendar", mensaje: t("Aún no hay eventos.") },
    ],
    [t]
  );

  const esPerfilPropio = usuarioActual?.id && perfil.id === usuarioActual.id;
  const contenidoActivo = opcionesPerfil.find((opcion) => opcion.id === tabActiva);

  useEffect(() => {
    if (usuarioActual?.id && identificador === usuarioActual.id) {
      navigate("/perfil", { replace: true });
    }
  }, [identificador, navigate, usuarioActual?.id]);

  useEffect(() => {
    let activo = true;

    const cargarPerfil = async () => {
      if (usuarioActual?.id && identificador === usuarioActual.id) return;

      setCargando(true);
      setAviso("");

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        const response = await fetch(apiUrl(`/api/usuarios/${identificador}/perfil`), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          const dataError = await response.json().catch(() => ({}));
          throw new Error(dataError.error || "No se pudo cargar el perfil.");
        }

        const dataPerfil = await response.json();
        if (!activo) return;

        setPerfil(dataPerfil.perfil);
        setContenido({
          publicaciones: dataPerfil.publicaciones || [],
          eventos: dataPerfil.eventos || [],
          seguidores: dataPerfil.seguidores || [],
          seguidos: dataPerfil.seguidos || [],
          stats: dataPerfil.stats || contenidoVacio.stats,
        });
        setSiguiendo(Boolean(dataPerfil.siguiendo));
        setSilenciado(Boolean(dataPerfil.silenciado));
      } catch (error) {
        console.error(error);
        if (activo) setAviso(error.message || "No se pudo cargar el perfil.");
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargarPerfil();
    return () => {
      activo = false;
    };
  }, [identificador, usuarioActual?.id]);

  const alternarSeguimiento = async () => {
    if (!usuarioActual) {
      setAviso("Tenes que iniciar sesion para seguir perfiles.");
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

      const response = await fetch(apiUrl(`/api/usuarios/${perfil.id || identificador}/seguir`), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo actualizar el seguimiento.");
      }

      const dataSeguimiento = await response.json();
      setSiguiendo(dataSeguimiento.siguiendo);
      if (!dataSeguimiento.siguiendo) setSilenciado(false);
      setContenido((actual) => ({
        ...actual,
        seguidores: dataSeguimiento.siguiendo
          ? actual.seguidores
          : actual.seguidores.filter((seguidor) => seguidor.id !== usuarioActual.id),
        stats: {
          ...actual.stats,
          seguidores: dataSeguimiento.seguidores,
        },
      }));
      window.dispatchEvent(new CustomEvent("sondar:seguimiento-actualizado"));
    } catch (error) {
      console.error(error);
      setAviso(error.message || "No se pudo actualizar el seguimiento.");
    }
  };

  const alternarSilencio = async () => {
    if (!usuarioActual || !siguiendo) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }
      const response = await fetch(
        apiUrl(`/api/usuarios/${perfil.id || identificador}/silenciar-notificaciones`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo actualizar la campana.");
      }
      const dataSilencio = await response.json();
      setSilenciado(Boolean(dataSilencio.silenciado));
      setAviso(dataSilencio.silenciado
        ? `Silenciaste las notificaciones de ${perfil.nombre}.`
        : `Activaste las notificaciones de ${perfil.nombre}.`);
    } catch (error) {
      console.error(error);
      setAviso(error.message || "No se pudo actualizar la campana.");
    }
  };

  const abrirListaSocial = (tipo) => {
    if (!usuarioActual) return;
    setListaSocialActiva(tipo);
  };

  const abrirPerfilSocial = (perfilSocial) => {
    setListaSocialActiva(null);
    if (!perfilSocial?.id) return;

    if (usuarioActual?.id && perfilSocial.id === usuarioActual.id) {
      navigate("/perfil");
      return;
    }

    navigate(`/perfil/${perfilSocial.id}`);
  };

  const enlacePerfil = () => {
    const enlace = new URL(window.location.origin);
    enlace.pathname = `/perfil/${perfil.id || identificador}`;
    return enlace.toString();
  };

  const renderContenidoActivo = () => {
    const items = contenido[tabActiva] || [];

    if (cargando) {
      return (
        <div className="perfil-empty-state">
          <span><IconoPerfil nombre={contenidoActivo?.icono || "grid"} /></span>
          <h3>{t("Cargando perfil...")}</h3>
          <p>Estamos trayendo el contenido desde Supabase.</p>
        </div>
      );
    }

    if (items.length > 0) {
      return (
        <div className="perfil-publicaciones-grid">
          {items.map((item) => tarjetaContenido(item, (contenidoItem) => navigate(destinoContenido(contenidoItem))))}
        </div>
      );
    }

    return (
      <div className="perfil-empty-state">
        <span><IconoPerfil nombre={contenidoActivo?.icono || "grid"} /></span>
        <h3>{contenidoActivo?.mensaje}</h3>
        <p>El contenido publicado por este usuario aparecera aca.</p>
      </div>
    );
  };

  return (
    <section className="perfil-page otroperfil-page">
      <header className="perfil-card">
        <div className="perfil-avatar-zone">
          <div className="perfil-avatar otroperfil-avatar">
            {perfil.avatar ? (
              <img src={perfil.avatar} alt={perfil.nombre} />
            ) : (
              <span>{perfil.nombre.charAt(0).toUpperCase()}</span>
            )}
          </div>
        </div>

        <div className="perfil-info">
          <div className="perfil-title-row">
            <h1>{perfil.nombre}</h1>
            {!esPerfilPropio ? (
              <button
                className={`perfil-primary-btn ${siguiendo ? "siguiendo" : ""}`}
                type="button"
                onClick={alternarSeguimiento}
              >
                {siguiendo ? "Siguiendo" : "Seguir"}
              </button>
            ) : null}
            {!esPerfilPropio && siguiendo ? (
              <button
                className={`perfil-notification-btn ${silenciado ? "silenciado" : ""}`}
                type="button"
                onClick={alternarSilencio}
                aria-label={silenciado ? "Activar notificaciones de este usuario" : "Silenciar notificaciones de este usuario"}
                title={silenciado ? "Notificaciones silenciadas" : "Notificaciones activas"}
              >
                <IconoPerfil nombre={silenciado ? "bellOff" : "bell"} size={20} />
              </button>
            ) : null}
            <button className="perfil-secondary-btn" type="button" onClick={() => setCompartirAbierto(true)}>
              <IconoPerfil nombre="share" size={18} />
              Compartir
            </button>
          </div>

          <div className="perfil-stats">
            <p><strong>{formatearNumero(contenido.stats.publicaciones)}</strong> publicaciones</p>
            {usuarioActual ? (
              <button type="button" onClick={() => abrirListaSocial("seguidores")}>
                <strong>{formatearNumero(contenido.stats.seguidores)}</strong> seguidores
              </button>
            ) : (
              <p><strong>{formatearNumero(contenido.stats.seguidores)}</strong> seguidores</p>
            )}
            {usuarioActual ? (
              <button type="button" onClick={() => abrirListaSocial("seguidos")}>
                <strong>{formatearNumero(contenido.stats.seguidos)}</strong> seguidos
              </button>
            ) : (
              <p><strong>{formatearNumero(contenido.stats.seguidos)}</strong> seguidos</p>
            )}
          </div>

          <div className="perfil-description">
            <strong>{perfil.nombre}</strong>
            <span>{perfil.usuario} - Artista en SONDAR</span>
            <p>{perfil.bio}</p>
          </div>
        </div>
      </header>

      <PerfilToast mensaje={aviso} onClose={() => setAviso("")} />

      {listaSocialActiva ? (
        <div className="perfil-modal-overlay" role="presentation" onMouseDown={() => setListaSocialActiva(null)}>
          <section
            className="perfil-social-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="perfil-social-titulo"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="perfil-modal-header">
              <h2 id="perfil-social-titulo">
                {listaSocialActiva === "seguidores" ? "Seguidores" : "Seguidos"}
              </h2>
              <button
                className="perfil-modal-close"
                type="button"
                onClick={() => setListaSocialActiva(null)}
                aria-label="Cerrar lista"
              >
                x
              </button>
            </div>
            <div className="perfil-social-lista">
              {(contenido[listaSocialActiva] || []).length > 0 ? (
                contenido[listaSocialActiva].map((perfilSocial) => (
                  <button
                    className="perfil-social-item"
                    type="button"
                    key={perfilSocial.id}
                    onClick={() => abrirPerfilSocial(perfilSocial)}
                  >
                    <span>
                      {perfilSocial.avatar ? (
                        <img src={perfilSocial.avatar} alt="" />
                      ) : (
                        perfilSocial.nombre.charAt(0).toUpperCase()
                      )}
                    </span>
                    <strong>{perfilSocial.nombre}</strong>
                    <small>{perfilSocial.usuario}</small>
                  </button>
                ))
              ) : (
                <p className="perfil-social-vacio">
                  {listaSocialActiva === "seguidores"
                    ? "Todavia no hay seguidores."
                    : "Todavia no sigue a nadie."}
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {compartirAbierto ? (
        <CompartirPerfilModal
          perfil={perfil}
          enlace={enlacePerfil()}
          onClose={() => setCompartirAbierto(false)}
          onAviso={setAviso}
        />
      ) : null}

      <div
        className="perfil-tabs"
        style={{
          "--perfil-tab-index": opcionesPerfil.findIndex((opcion) => opcion.id === tabActiva),
          "--perfil-tab-count": opcionesPerfil.length,
        }}
      >
        {opcionesPerfil.map((opcion) => (
          <button
            key={opcion.id}
            className={tabActiva === opcion.id ? "active" : ""}
            type="button"
            onClick={() => setTabActiva(opcion.id)}
          >
            <IconoPerfil nombre={opcion.icono} />
            <span>{opcion.label}</span>
          </button>
        ))}
      </div>

      <div className="perfil-tab-content">
        {renderContenidoActivo()}
      </div>
    </section>
  );
}
