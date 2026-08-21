import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { usePreferencias } from "../contextos/PreferenciasContext";
import "./buscar.css";

const TABS = [
  { id: "todo", label: "Todo" },
  { id: "usuarios", label: "Usuarios" },
  { id: "reels", label: "Reels" },
  { id: "eventos", label: "Eventos" },
];

const iconosBuscar = {
  usuario:
    "M234-276q51-39 114-61.5T480-360q69 0 132 22.5T726-276q35-41 54.5-93T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 59 19.5 111t54.5 93Zm246-204q-59 0-99.5-40.5T340-620q0-59 40.5-99.5T480-760q59 0 99.5 40.5T620-620q0 59-40.5 99.5T480-480Z",
  reel: "m380-300 280-180-280-180v360Zm100 220q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
  evento:
    "M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z",
};

function IconoBuscar({ nombre }) {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" width="22" height="22" fill="currentColor">
      <path d={iconosBuscar[nombre]} />
    </svg>
  );
}

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function coincide(item, campos, query) {
  const termino = normalizar(query);
  return campos.some((campo) => normalizar(item?.[campo]).includes(termino));
}

function formatearNumero(valor) {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(valor || 0));
}

function formatearFecha(fecha) {
  if (!fecha) return "Fecha sin definir";
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return fecha;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(valor);
}

function mostrarGenero(genero) {
  if (!genero) return "Sin genero";
  return genero === "edm" ? "EDM" : genero.charAt(0).toUpperCase() + genero.slice(1);
}

function mostrarGenerosEvento(evento) {
  const generos = Array.isArray(evento?.generos) && evento.generos.length > 0
    ? evento.generos
    : [evento?.genero];
  return [...new Set(generos.filter(Boolean))].map(mostrarGenero).join(" / ") || "Sin genero";
}

export default function Buscar({ usuario }) {
  const { t } = usePreferencias();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("query")?.trim() || "";
  const [tabActiva, setTabActiva] = useState("todo");
  const [usuarios, setUsuarios] = useState([]);
  const [reels, setReels] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTabActiva("todo");
  }, [query]);

  useEffect(() => {
    let activo = true;

    const cargarResultados = async () => {
      if (!query) {
        setUsuarios([]);
        setReels([]);
        setEventos([]);
        setError("");
        return;
      }

      setCargando(true);
      setError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const encodedQuery = encodeURIComponent(query);

        const [usuariosResult, reelsResult, eventosResult] = await Promise.allSettled([
          apiRequest(`/api/usuarios?query=${encodedQuery}`, { headers }),
          apiRequest("/api/reels", { headers }),
          apiRequest("/api/eventos", { headers }),
        ]);

        const usuariosData =
          usuariosResult.status === "fulfilled" && usuariosResult.value.ok
            ? await usuariosResult.value.json()
            : [];
        const reelsData =
          reelsResult.status === "fulfilled" && reelsResult.value.ok
            ? await reelsResult.value.json()
            : [];
        const eventosData =
          eventosResult.status === "fulfilled" && eventosResult.value.ok
            ? await eventosResult.value.json()
            : [];

        if (!activo) return;

        setUsuarios(usuariosData);
        setReels(
          reelsData.filter((reel) =>
            coincide(reel, ["tema", "artista", "usuario", "genero"], query)
          )
        );
        setEventos(
          eventosData
            .map((evento) => ({
              ...evento,
              img: "/sondar-icon.png?v=19",
            }))
            .filter((evento) =>
              coincide(evento, ["genero", "generos", "lugar", "ubicacion", "creador"], query)
            )
        );
      } catch (err) {
        console.error(err);
        if (activo) setError("No se pudo completar la busqueda.");
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargarResultados();
    return () => {
      activo = false;
    };
  }, [query, usuario?.id]);

  const totalResultados = usuarios.length + reels.length + eventos.length;
  const resultadoDestacado = useMemo(() => {
    if (reels[0]) return { tipo: "reel", item: reels[0] };
    if (usuarios[0]) return { tipo: "usuario", item: usuarios[0] };
    if (eventos[0]) return { tipo: "evento", item: eventos[0] };
    return null;
  }, [usuarios, reels, eventos]);

  const abrirUsuario = (item) => navigate(`/perfil/${item.id || item.username}`);
  const abrirReel = (item) => {
    const id = item.backendId || String(item.id).replace(/^db-/, "");
    navigate(`/descubrir?lanzamiento=db-${id}`);
  };
  const abrirEvento = (item) => navigate(`/?evento=${item.id}`);

  const abrirResultado = (resultado) => {
    if (!resultado) return;
    if (resultado.tipo === "usuario") abrirUsuario(resultado.item);
    if (resultado.tipo === "reel") abrirReel(resultado.item);
    if (resultado.tipo === "evento") abrirEvento(resultado.item);
  };

  const renderImagen = (src, texto, clase = "") => (
    <div className={`buscar-thumb ${clase}`}>
      {src ? <img src={src} alt="" /> : <span>{texto?.charAt(0)?.toUpperCase() || "S"}</span>}
    </div>
  );

  const renderUsuario = (item) => (
    <article className="buscar-row" key={`usuario-${item.id}`}>
      <button className="buscar-row-main" type="button" onClick={() => abrirUsuario(item)}>
        {renderImagen(item.avatar, item.nombre, "usuario")}
        <span>
          <strong>{item.nombre}</strong>
          <small>{item.usuario} - {item.user_type === "organizador" ? "Organizador" : "Artista"}</small>
        </span>
      </button>
      <span className="buscar-tag">Usuario</span>
      <small className="buscar-meta">{formatearNumero(item.seguidores)} seguidores</small>
      <button className="buscar-action" type="button" onClick={() => abrirUsuario(item)}>
        Ver perfil
      </button>
    </article>
  );

  const renderReel = (item) => (
    <article className="buscar-row" key={`reel-${item.id}`}>
      <button className="buscar-row-main" type="button" onClick={() => abrirReel(item)}>
        {renderImagen(item.portada, item.tema)}
        <span>
          <strong>{item.tema}</strong>
          <small>{item.artista} - {mostrarGenero(item.genero)}</small>
        </span>
      </button>
      <span className="buscar-tag">Reel</span>
      <small className="buscar-meta">{formatearNumero(item.likes)} me gusta</small>
      <button className="buscar-icon-action" type="button" onClick={() => abrirReel(item)} aria-label={`Abrir ${item.tema}`}>
        <IconoBuscar nombre="reel" />
      </button>
    </article>
  );

  const renderEvento = (item) => (
    <article className="buscar-row" key={`evento-${item.id}`}>
      <button className="buscar-row-main" type="button" onClick={() => abrirEvento(item)}>
        {renderImagen(item.img, item.creador || "Artista SONDAR")}
        <span>
          <strong>{item.creador || "Artista SONDAR"}</strong>
          <small>{mostrarGenerosEvento(item)} · {item.lugar || item.ubicacion || "Lugar sin definir"}</small>
        </span>
      </button>
      <span className="buscar-tag">Evento</span>
      <small className="buscar-meta">{formatearFecha(item.fecha)}</small>
      <button className="buscar-icon-action" type="button" onClick={() => abrirEvento(item)} aria-label={`Abrir evento de ${item.creador || "Artista SONDAR"}`}>
        <IconoBuscar nombre="evento" />
      </button>
    </article>
  );

  const renderLista = () => {
    if (!query) {
      return (
        <div className="buscar-empty">
          <IconoBuscar nombre="reel" />
          <h2>{t("Busca en SONDAR")}</h2>
          <p>Encontra usuarios, reels y eventos desde un solo lugar.</p>
        </div>
      );
    }

    if (cargando) {
      return <div className="buscar-empty">{t("Buscando...")}</div>;
    }

    if (error) {
      return <div className="buscar-empty">{error}</div>;
    }

    if (totalResultados === 0) {
      return (
        <div className="buscar-empty">
          <h2>No hay resultados para "{query}"</h2>
          <p>Proba con otro artista, genero, evento o cancion.</p>
        </div>
      );
    }

    if (tabActiva === "usuarios") {
      return usuarios.length > 0 ? usuarios.map(renderUsuario) : (
        <div className="buscar-empty">No encontramos usuarios para "{query}".</div>
      );
    }

    if (tabActiva === "reels") {
      return reels.length > 0 ? reels.map(renderReel) : (
        <div className="buscar-empty">No encontramos reels para "{query}".</div>
      );
    }

    if (tabActiva === "eventos") {
      return eventos.length > 0 ? eventos.map(renderEvento) : (
        <div className="buscar-empty">No encontramos eventos para "{query}".</div>
      );
    }

    return (
      <>
        {resultadoDestacado ? (
          <button
            className="buscar-destacado"
            type="button"
            onClick={() => abrirResultado(resultadoDestacado)}
          >
            {resultadoDestacado.tipo === "usuario"
              ? renderImagen(resultadoDestacado.item.avatar, resultadoDestacado.item.nombre, "usuario grande")
              : renderImagen(resultadoDestacado.item.portada || resultadoDestacado.item.img, resultadoDestacado.item.tema || resultadoDestacado.item.creador || "Artista SONDAR", "grande")}
            <span>
              <small>Mejor resultado</small>
              <strong>
                {resultadoDestacado.item.tema || resultadoDestacado.item.nombre || resultadoDestacado.item.creador || "Artista SONDAR"}
              </strong>
              <em>
                {resultadoDestacado.tipo === "reel"
                  ? `Reel - ${resultadoDestacado.item.artista}`
                  : resultadoDestacado.tipo === "usuario"
                    ? `Usuario - ${resultadoDestacado.item.usuario}`
                    : `Evento - ${formatearFecha(resultadoDestacado.item.fecha)}`}
              </em>
            </span>
          </button>
        ) : null}

        {usuarios.length > 0 ? (
          <section className="buscar-section">
            <header>
              <h2>{t("Usuarios")}</h2>
              <button type="button" onClick={() => setTabActiva("usuarios")}>Ver mas</button>
            </header>
            {usuarios.slice(0, 4).map(renderUsuario)}
          </section>
        ) : null}

        {reels.length > 0 ? (
          <section className="buscar-section">
            <header>
              <h2>{t("Reels")}</h2>
              <button type="button" onClick={() => setTabActiva("reels")}>Ver mas</button>
            </header>
            {reels.slice(0, 4).map(renderReel)}
          </section>
        ) : null}

        {eventos.length > 0 ? (
          <section className="buscar-section">
            <header>
              <h2>{t("Eventos")}</h2>
              <button type="button" onClick={() => setTabActiva("eventos")}>Ver mas</button>
            </header>
            {eventos.slice(0, 4).map(renderEvento)}
          </section>
        ) : null}
      </>
    );
  };

  return (
    <section className="buscar-page">
      <header className="buscar-header">
        <span>Busqueda global</span>
        <h1>{query ? `${t("Resultados para")} "${query}"` : t("Buscar")}</h1>
        <p>Usuarios, reels y eventos reunidos en una misma pantalla.</p>
      </header>

      <div className="buscar-tabs" aria-label="Filtros de busqueda">
        {TABS.map((tab) => {
          const cantidad =
            tab.id === "usuarios" ? usuarios.length :
            tab.id === "reels" ? reels.length :
            tab.id === "eventos" ? eventos.length :
            totalResultados;

          return (
            <button
              key={tab.id}
              className={tabActiva === tab.id ? "activo" : ""}
              type="button"
              onClick={() => setTabActiva(tab.id)}
            >
              {tab.label}
              {query ? <small>{cantidad}</small> : null}
            </button>
          );
        })}
      </div>

      <div className="buscar-resultados">
        {renderLista()}
      </div>
    </section>
  );
}
