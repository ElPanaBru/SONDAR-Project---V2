import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import "./miperfil.css";
import "./otroperfil.css";

const iconosPerfil = {
  grid: "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-480h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-360h160v-160H200v160Zm240 0h160v-160H440v160Zm240 0h80v-160h-80v160ZM200-200h160v-80H200v80Zm240 0h160v-80H440v80Zm240 0h80v-80h-80v80Z",
  calendar: "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
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
  stats: {
    publicaciones: 0,
    seguidores: 0,
    seguidos: 0,
  },
};

function IconoPerfil({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="20" height="20" fill="currentColor">
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
  const { usuario: identificador } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const perfilInicial = crearPerfilDesdeEstado(location.state?.artista) || perfilVacio;
  const [perfil, setPerfil] = useState(perfilInicial);
  const [contenido, setContenido] = useState(contenidoVacio);
  const [siguiendo, setSiguiendo] = useState(false);
  const [tabActiva, setTabActiva] = useState("publicaciones");
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState("");

  const opcionesPerfil = useMemo(
    () => [
      { id: "publicaciones", label: "Publicaciones", icono: "grid", mensaje: "Aun no hay publicaciones." },
      { id: "eventos", label: "Eventos", icono: "calendar", mensaje: "Aun no hay eventos." },
    ],
    []
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

        if (!token) {
          setAviso("Inicia sesion para ver perfiles registrados.");
          return;
        }

        const response = await fetch(apiUrl(`/api/usuarios/${identificador}/perfil`), {
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
        setContenido({
          publicaciones: dataPerfil.publicaciones || [],
          eventos: dataPerfil.eventos || [],
          stats: dataPerfil.stats || contenidoVacio.stats,
        });
        setSiguiendo(Boolean(dataPerfil.siguiendo));
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
      setContenido((actual) => ({
        ...actual,
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

  const renderContenidoActivo = () => {
    const items = contenido[tabActiva] || [];

    if (cargando) {
      return (
        <div className="perfil-empty-state">
          <span><IconoPerfil nombre={contenidoActivo?.icono || "grid"} /></span>
          <h3>Cargando perfil...</h3>
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
            <button className="perfil-secondary-btn" type="button">
              Mensaje
            </button>
          </div>

          <div className="perfil-stats">
            <p><strong>{formatearNumero(contenido.stats.publicaciones)}</strong> publicaciones</p>
            <p><strong>{formatearNumero(contenido.stats.seguidores)}</strong> seguidores</p>
            <p><strong>{formatearNumero(contenido.stats.seguidos)}</strong> seguidos</p>
          </div>

          <div className="perfil-description">
            <strong>{perfil.nombre}</strong>
            <span>{perfil.usuario} - Artista en SONDAR</span>
            <p>{perfil.bio}</p>
          </div>
        </div>
      </header>

      {aviso ? (
        <div className="perfil-toast" role="status">
          {aviso}
        </div>
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
