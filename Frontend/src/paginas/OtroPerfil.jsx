import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import CompartirPerfilModal from "../componentes/CompartirPerfilModal";
import PerfilComunidad from "../componentes/PerfilComunidad";
import PerfilSocialModal from "../componentes/PerfilSocialModal";
import PerfilToast from "../componentes/PerfilToast";
import DenunciaModal, { etiquetaMotivoDenuncia } from "../componentes/DenunciaModal";
import { apiRequest } from "../lib/api";
import { avisarDenunciaASoporte } from "../lib/reportarContenido";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./miperfil.css";
import "./otroperfil.css";

const iconosPerfil = {
  grid: "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-480h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-360h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-200h160v-80H200v80Zm240 0h160v-80H440v80Zm240 0h80v-80h-80v80Z",
  calendar: "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  community: "M80-160v-120q0-45 23.5-84.5T168-427q67-34 144.5-53.5T480-500q90 0 167.5 19.5T792-427q42 23 65 62.5t23 84.5v120H80Zm400-420q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z",
  share: "M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-712L356-548q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Z",
  lock: "M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z",
  bell: "M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320 120q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z",
  bellOff: "m792-56-96-96H160v-80h80v-280q0-22 3-43t10-41L56-792l56-56 736 736-56 56ZM320-232h296L320-528v296Zm400-40-80-80v-160q0-66-47-113t-113-47q-17 0-32.5 3T417-660l-62-62q16-10 32-17.5t33-12.5v-20q0-25 17.5-42.5T480-832q25 0 42.5 17.5T540-772v20q80 20 130 84.5T720-512v240ZM480-32q-33 0-56.5-23.5T400-112h160q0 33-23.5 56.5T480-32Z",
  more: "M240-400q-33 0-56.5-23.5T160-480q0-33 23.5-56.5T240-560q33 0 56.5 23.5T320-480q0 33-23.5 56.5T240-400Zm240 0q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm240 0q-33 0-56.5-23.5T640-480q0-33 23.5-56.5T720-560q33 0 56.5 23.5T800-480q0 33-23.5 56.5T720-400Z",
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
    reels: 0,
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
    bio: "Artista en SONDAR.",
    avatar: artista.portada,
  };
}

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor || 0);
}

function destinoContenido(item) {
  if (item.tipo === "evento") return `/?evento=${item.id}`;
  const parametros = new URLSearchParams({ lanzamiento: `db-${item.id}` });
  if (item.creadorId) parametros.set("creador", item.creadorId);
  return `/descubrir?${parametros.toString()}`;
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
      {item.tipo === "reel" ? (
        <span className="perfil-publicacion-visitas" aria-label={`${formatearNumero(item.visitas)} visitas`}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M8 5.4v13.2L18.5 12 8 5.4Z" />
          </svg>
          {formatearNumero(item.visitas)}
        </span>
      ) : null}
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
  const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(false);
  const [denunciaPendiente, setDenunciaPendiente] = useState(false);
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);

  const opcionesPerfil = useMemo(
    () => [
      { id: "publicaciones", label: t("Previews"), icono: "grid", mensaje: t("Aún no hay previews.") },
      { id: "eventos", label: t("Eventos"), icono: "calendar", mensaje: t("Aún no hay eventos.") },
      { id: "comunidad", label: t("Comunidad"), icono: "community", mensaje: t("Aún no hay publicaciones en la comunidad.") },
    ],
    [t]
  );

  const esPerfilPropio = usuarioActual?.id && perfil.id === usuarioActual.id;
  const contenidoActivo = opcionesPerfil.find((opcion) => opcion.id === tabActiva);

  useEffect(() => {
    if (usuarioActual?.id && identificador === usuarioActual.id) {
      navigate(`/perfil${location.search}`, { replace: true });
    }
  }, [identificador, location.search, navigate, usuarioActual?.id]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("tab") === "comunidad") {
      setTabActiva("comunidad");
    }
  }, [location.search]);

  useEffect(() => {
    let activo = true;

    const cargarPerfil = async () => {
      if (usuarioActual?.id && identificador === usuarioActual.id) return;

      setCargando(true);
      setAviso("");

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        const response = await apiRequest(`/api/usuarios/${identificador}/perfil`, {
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

      const response = await apiRequest(`/api/usuarios/${perfil.id || identificador}/seguir`, {
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

  const iniciarMensaje = async () => {
    if (!usuarioActual) {
      setAviso("Tenes que iniciar sesion para enviar mensajes.");
      return;
    }
    if (!perfil.id) return;
    try {
      const response = await apiRequest("/api/mensajes/conversaciones", {
        method: "POST",
        body: { userId: perfil.id },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo iniciar la conversacion.");
      navigate(`/mensajes?conversacion=${encodeURIComponent(data.id)}`);
    } catch (error) {
      setAviso(error.message || "No se pudo iniciar la conversacion.");
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
      const response = await apiRequest(`/api/usuarios/${perfil.id || identificador}/silenciar-notificaciones`,
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

  const bloquearPerfil = async () => {
    setMenuAccionesAbierto(false);
    if (!usuarioActual) {
      setAviso("Tenes que iniciar sesion para bloquear usuarios.");
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion expiro. Volve a iniciar sesion.");
      const response = await apiRequest(`/api/usuarios/${perfil.id || identificador}/bloquear`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo bloquear la cuenta.");
      window.dispatchEvent(new CustomEvent("sondar:bloqueos-actualizados"));
      navigate("/", { replace: true });
    } catch (error) {
      setAviso(error.message || "No se pudo bloquear la cuenta.");
    }
  };

  const denunciarPerfil = async ({ motivo, detalle }) => {
    if (!usuarioActual) {
      setAviso("Tenes que iniciar sesion para denunciar usuarios.");
      return;
    }
    setEnviandoDenuncia(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion expiro. Volve a iniciar sesion.");
      const response = await apiRequest(`/api/usuarios/${perfil.id || identificador}/denunciar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: motivo, detail: detalle }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo denunciar la cuenta.");
      setDenunciaPendiente(false);
      if (body.nuevaDenuncia === false) {
        setAviso("Ya habias denunciado este perfil.");
        return;
      }
      try {
        await avisarDenunciaASoporte({
          usuario: usuarioActual,
          tipo: "perfil",
          contenidoId: perfil.id || identificador,
          titulo: perfil.nombre,
          autor: perfil.usuario,
          motivo: etiquetaMotivoDenuncia(motivo),
          detalle,
        });
        setAviso("Perfil denunciado. Soporte fue notificado.");
      } catch (emailError) {
        console.error("Email de denuncia:", emailError);
        setAviso("La denuncia fue registrada, pero no se pudo enviar el email a soporte.");
      }
    } catch (error) {
      setAviso(error.message || "No se pudo denunciar la cuenta.");
    } finally {
      setEnviandoDenuncia(false);
    }
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

    if (tabActiva === "comunidad") {
      return (
        <PerfilComunidad
          perfil={perfil}
          usuarioActual={usuarioActual}
          esPropio={Boolean(esPerfilPropio)}
          onAviso={setAviso}
        />
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
              <div className="otroperfil-acciones">
                <button
                  className={`otroperfil-accion-texto otroperfil-seguir ${siguiendo ? "siguiendo" : ""}`}
                  type="button"
                  onClick={alternarSeguimiento}
                >
                  {siguiendo ? "Siguiendo" : "Seguir"}
                </button>
                <button
                  className="otroperfil-accion-texto"
                  type="button"
                  onClick={iniciarMensaje}
                >
                  Mensaje
                </button>
                {siguiendo ? (
                  <button
                    className={`otroperfil-accion-icono ${silenciado ? "silenciado" : ""}`}
                    type="button"
                    onClick={alternarSilencio}
                    aria-label={silenciado ? "Activar notificaciones de este usuario" : "Silenciar notificaciones de este usuario"}
                    title={silenciado ? "Notificaciones silenciadas" : "Notificaciones activas"}
                  >
                    <IconoPerfil nombre={silenciado ? "bellOff" : "bell"} size={22} />
                  </button>
                ) : null}
                <button
                  className="otroperfil-accion-icono"
                  type="button"
                  onClick={() => setCompartirAbierto(true)}
                  aria-label="Compartir perfil"
                  title="Compartir perfil"
                >
                  <IconoPerfil nombre="share" size={21} />
                </button>
                <div className="otroperfil-mas-wrap">
                  <button
                    className={`otroperfil-accion-icono ${menuAccionesAbierto ? "activo" : ""}`}
                    type="button"
                    onClick={() => setMenuAccionesAbierto((abierto) => !abierto)}
                    aria-label="Mas opciones"
                    aria-expanded={menuAccionesAbierto}
                    aria-haspopup="menu"
                  >
                    <IconoPerfil nombre="more" size={23} />
                  </button>
                  {menuAccionesAbierto ? (
                    <div className="otroperfil-mas-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={bloquearPerfil}
                      >
                        Bloquear
                      </button>
                      <button
                        className="denunciar"
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuAccionesAbierto(false);
                          if (!usuarioActual) {
                            setAviso("Tenes que iniciar sesion para denunciar usuarios.");
                            return;
                          }
                          setDenunciaPendiente(true);
                        }}
                      >
                        Denunciar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="perfil-stats">
            <p><strong>{formatearNumero(contenido.stats.reels ?? contenido.publicaciones.length)}</strong> previews</p>
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

      <PerfilSocialModal
        abierto={Boolean(listaSocialActiva)}
        titulo={listaSocialActiva === "seguidores" ? "Seguidores" : "Seguidos"}
        perfiles={contenido[listaSocialActiva] || []}
        mensajeVacio={
          listaSocialActiva === "seguidores"
            ? "Todavia no hay seguidores."
            : "Todavia no sigue a nadie."
        }
        onClose={() => setListaSocialActiva(null)}
        onSelect={abrirPerfilSocial}
      />

      <DenunciaModal
        abierto={denunciaPendiente}
        titulo={perfil.nombre}
        enviando={enviandoDenuncia}
        onClose={() => setDenunciaPendiente(false)}
        onConfirm={denunciarPerfil}
      />

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
