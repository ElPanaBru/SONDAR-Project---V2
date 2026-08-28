import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CompartirPerfilModal from "../componentes/CompartirPerfilModal";
import PerfilComunidad from "../componentes/PerfilComunidad";
import PerfilSocialModal from "../componentes/PerfilSocialModal";
import PerfilToast from "../componentes/PerfilToast";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./miperfil.css";

const iconosPerfil = {
  grid: "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-480h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-360h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-200h160v-80H200v80Zm240 0h160v-80H440v80Zm240 0h80v-80h-80v80Z",
  calendar: "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
  heart: "m480-120-58-52q-101-91-167-157T150-447q-39-51-54.5-94T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 50-15.5 93T810-447q-39 52-105 118T538-172l-58 52Z",
  bookmark: "M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Z",
  community: "M80-160v-120q0-45 23.5-84.5T168-427q67-34 144.5-53.5T480-500q90 0 167.5 19.5T792-427q42 23 65 62.5t23 84.5v120H80Zm400-420q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Z",
  share: "M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-712L356-548q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Z",
  lock: "M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm240-200q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z",
};

const contenidoInicial = {
  publicaciones: [],
  eventos: [],
  favoritos: [],
  guardados: [],
  seguidores: [],
  seguidos: [],
  stats: {
    publicaciones: 0,
    seguidores: 0,
    seguidos: 0,
  },
};

function IconoPerfil({ nombre, size = 22 }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width={size} height={size} fill="currentColor">
      <path d={iconosPerfil[nombre]} />
    </svg>
  );
}

function perfilDesdeUsuario(usuario) {
  const nombre =
    usuario?.user_metadata?.username ||
    usuario?.user_metadata?.name ||
    usuario?.email?.split("@")[0] ||
    "nombreUsuario";

  return {
    nombre,
    usuario: usuario?.email ? `@${usuario.email.split("@")[0]}` : "@usuario",
    bio: "Artista en SONDAR.",
    avatar: "",
  };
}

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(valor || 0);
}

function iconoTab(tab) {
  if (tab === "eventos") return "calendar";
  if (tab === "favoritos") return "heart";
  if (tab === "guardados") return "bookmark";
  if (tab === "comunidad") return "community";
  return "grid";
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
      <div className="perfil-publicacion-img">
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

export default function MiPerfil({ usuario, tabInicial = "publicaciones" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = usePreferencias();
  const [editando, setEditando] = useState(false);
  const [tabActiva, setTabActiva] = useState(tabInicial);
  const [perfil, setPerfil] = useState(() => perfilDesdeUsuario(usuario));
  const [perfilEditado, setPerfilEditado] = useState(() => perfilDesdeUsuario(usuario));
  const [contenido, setContenido] = useState(contenidoInicial);
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [listaSocialActiva, setListaSocialActiva] = useState(null);
  const [compartirAbierto, setCompartirAbierto] = useState(false);
  const [avatarArchivo, setAvatarArchivo] = useState(null);
  const [avatarArrastrado, setAvatarArrastrado] = useState(false);

  const opcionesPerfil = useMemo(
    () => [
      { id: "publicaciones", label: t("Publicaciones"), mensaje: t("Aún no hay publicaciones.") },
      { id: "eventos", label: t("Eventos"), mensaje: t("Aún no hay eventos.") },
      { id: "favoritos", label: t("Favoritos"), mensaje: t("Aún no hay favoritos.") },
      { id: "guardados", label: t("Guardados"), mensaje: t("Aún no hay guardados.") },
      { id: "comunidad", label: t("Comunidad"), mensaje: t("Aún no hay publicaciones en la comunidad.") },
    ],
    [t]
  );

  const contenidoActivo = opcionesPerfil.find((opcion) => opcion.id === tabActiva);
  const inicial = perfil.nombre.trim().charAt(0).toUpperCase() || "S";

  useEffect(() => {
    const tabSolicitada = new URLSearchParams(location.search).get("tab");
    setTabActiva(tabSolicitada === "comunidad" ? "comunidad" : tabInicial);
  }, [location.search, tabInicial]);

  useEffect(() => {
    const avatarPreview = perfilEditado.avatar;
    return () => {
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [perfilEditado.avatar]);

  useEffect(() => {
    let activo = true;

    const cargarPerfil = async () => {
      if (!usuario) {
        const fallback = perfilDesdeUsuario(null);
        setPerfil(fallback);
        setPerfilEditado(fallback);
        setContenido(contenidoInicial);
        return;
      }

      setCargando(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const response = await apiRequest("/api/usuarios/me/perfil", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const dataError = await response.json().catch(() => ({}));
          throw new Error(dataError.error || "No se pudo cargar el perfil.");
        }

        const dataPerfil = await response.json();
        if (!activo) return;

        setPerfil(dataPerfil.perfil);
        setPerfilEditado(dataPerfil.perfil);
        setContenido({
          publicaciones: dataPerfil.publicaciones || [],
          eventos: dataPerfil.eventos || [],
          favoritos: dataPerfil.favoritos || [],
          guardados: dataPerfil.guardados || [],
          seguidores: dataPerfil.seguidores || [],
          seguidos: dataPerfil.seguidos || [],
          stats: dataPerfil.stats || contenidoInicial.stats,
        });
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
  }, [usuario]);

  const abrirEditor = () => {
    setPerfilEditado(perfil);
    setAvatarArchivo(null);
    setEditando(true);
  };

  const cerrarEditor = () => {
    setPerfilEditado(perfil);
    setAvatarArchivo(null);
    setEditando(false);
  };

  const handleChange = (event) => {
    setPerfilEditado({
      ...perfilEditado,
      [event.target.name]: event.target.value,
    });
  };

  const seleccionarAvatar = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAviso("Arrastra un archivo de imagen valido.");
      return;
    }

    setAvatarArchivo(file);
    setPerfilEditado((prev) => ({
      ...prev,
      avatar: URL.createObjectURL(file),
    }));
  };

  const handleAvatar = (event) => seleccionarAvatar(event.target.files?.[0]);

  const soltarAvatar = (event) => {
    event.preventDefault();
    setAvatarArrastrado(false);
    seleccionarAvatar(event.dataTransfer.files?.[0]);
  };

  const guardarPerfil = async (event) => {
    event.preventDefault();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setAviso("Tu sesion expiro. Volve a iniciar sesion.");
        return;
      }

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

      if (!response.ok) {
        const dataError = await response.json().catch(() => ({}));
        throw new Error(dataError.error || "No se pudo guardar el perfil.");
      }

      const perfilGuardado = await response.json();
      setPerfil(perfilGuardado);
      setPerfilEditado(perfilGuardado);
      setAvatarArchivo(null);
      window.dispatchEvent(new CustomEvent("sondar-perfil-actualizado", { detail: perfilGuardado }));
      setEditando(false);
      setAviso("Perfil guardado");
    } catch (error) {
      console.error(error);
      setAviso(error.message || "No se pudo guardar el perfil.");
    }
  };

  const enlacePerfil = () => {
    const enlace = new URL(window.location.origin);
    enlace.pathname = "/perfil";
    return enlace.toString();
  };

  const abrirCompartirPerfil = () => {
    setCompartirAbierto(true);
  };

  const abrirListaSocial = (tipo) => {
    setListaSocialActiva(tipo);
  };

  const abrirPerfilSocial = (perfilSocial) => {
    setListaSocialActiva(null);
    if (!perfilSocial?.id || perfilSocial.id === usuario?.id) {
      navigate("/perfil");
      return;
    }
    navigate(`/perfil/${perfilSocial.id}`);
  };

  const renderContenidoActivo = () => {
    const items = contenido[tabActiva] || [];

    if (cargando) {
      return (
        <div className="perfil-empty-state">
          <span><IconoPerfil nombre={iconoTab(tabActiva)} size={34} /></span>
          <h3>{t("Cargando perfil...")}</h3>
          <p>Estamos trayendo tu contenido desde Supabase.</p>
        </div>
      );
    }

    if (tabActiva === "comunidad") {
      return (
        <PerfilComunidad
          perfil={perfil}
          usuarioActual={usuario}
          esPropio
          reelsPropios={contenido.publicaciones}
          eventosPropios={contenido.eventos}
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
        <span><IconoPerfil nombre={iconoTab(tabActiva)} size={34} /></span>
        <h3>{contenidoActivo?.mensaje}</h3>
        <p>Cuando haya contenido guardado en Supabase, aparecera en esta seccion.</p>
      </div>
    );
  };

  return (
    <section className="perfil-page">
      <header className="perfil-card">
        <div className="perfil-avatar-zone">
          <div className="perfil-avatar">
            {perfil.avatar ? (
              <img src={perfil.avatar} alt={perfil.nombre} />
            ) : (
              <span>{inicial}</span>
            )}
          </div>
        </div>

        <div className="perfil-info">
          <div className="perfil-title-row">
            <h1>{perfil.nombre}</h1>
            <button className="perfil-primary-btn" type="button" onClick={abrirEditor}>
              Editar perfil
            </button>
            <button className="perfil-secondary-btn" type="button" onClick={abrirCompartirPerfil}>
              <IconoPerfil nombre="share" size={18} />
              Compartir
            </button>
          </div>

          <div className="perfil-stats">
            <p><strong>{formatearNumero(contenido.stats.publicaciones)}</strong> publicaciones</p>
            <button type="button" onClick={() => abrirListaSocial("seguidores")}>
              <strong>{formatearNumero(contenido.stats.seguidores)}</strong> seguidores
            </button>
            <button type="button" onClick={() => abrirListaSocial("seguidos")}>
              <strong>{formatearNumero(contenido.stats.seguidos)}</strong> seguidos
            </button>
          </div>

          <div className="perfil-description">
            <strong>{perfil.nombre}</strong>
            <span>{perfil.usuario} - Artista en SONDAR</span>
            <p>{perfil.bio}</p>
          </div>
        </div>
      </header>

      <PerfilToast mensaje={aviso} onClose={() => setAviso("")} />

      {editando ? (
        <div className="perfil-modal-overlay" role="dialog" aria-modal="true">
          <form className="perfil-modal" onSubmit={guardarPerfil}>
            <div className="perfil-modal-header">
              <h2>{t("Editar perfil")}</h2>
              <button className="perfil-modal-close" type="button" onClick={cerrarEditor} aria-label="Cerrar editor">
                x
              </button>
            </div>

            <div className="perfil-modal-body">
              <div className="perfil-modal-avatar">
                <div className="perfil-avatar">
                  {perfilEditado.avatar ? (
                    <img src={perfilEditado.avatar} alt={perfilEditado.nombre} />
                  ) : (
                    <span>{perfilEditado.nombre.trim().charAt(0).toUpperCase() || "S"}</span>
                  )}
                </div>

                <label
                  className={`perfil-avatar-upload ${avatarArrastrado ? "arrastrando" : ""}`}
                  onDragEnter={(event) => { event.preventDefault(); setAvatarArrastrado(true); }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setAvatarArrastrado(false);
                  }}
                  onDrop={soltarAvatar}
                >
                  Elegir o arrastrar foto
                  <input type="file" accept="image/*" onChange={handleAvatar} />
                </label>
              </div>

              <div className="perfil-form">
                <label>
                  Nombre de usuario
                  <input
                    type="text"
                    name="nombre"
                    value={perfilEditado.nombre}
                    onChange={handleChange}
                    maxLength="32"
                    required
                  />
                </label>

                <label>
                  Descripcion
                  <textarea
                    name="bio"
                    value={perfilEditado.bio}
                    onChange={handleChange}
                    rows="6"
                    maxLength="180"
                  />
                </label>

                <div className="perfil-form-actions">
                  <button type="submit">Guardar</button>
                  <button type="button" onClick={cerrarEditor}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <PerfilSocialModal
        abierto={Boolean(listaSocialActiva)}
        titulo={listaSocialActiva === "seguidores" ? "Seguidores" : "Seguidos"}
        perfiles={contenido[listaSocialActiva] || []}
        mensajeVacio={
          listaSocialActiva === "seguidores"
            ? "Todavia no hay seguidores."
            : "Todavia no seguis a nadie."
        }
        onClose={() => setListaSocialActiva(null)}
        onSelect={abrirPerfilSocial}
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
            <IconoPerfil nombre={iconoTab(opcion.id)} size={20} />
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
