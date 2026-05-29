import { useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import "./otroperfil.css";

const perfilesBase = {
  "luna-norte": {
    artista: "Luna Norte",
    usuario: "@lunanorte",
    oyentes: "12.8K",
    ciudad: "Buenos Aires",
    bio: "Productora indie con sintetizadores brillantes, bajos suaves y letras nocturnas.",
    colorA: "#ffae00",
    colorB: "#ff5e00",
    publicaciones: [
      { id: 1, titulo: "Ruido de ciudad", subtitulo: "Demo principal", progreso: "34%" },
      { id: 2, titulo: "Neon de madrugada", subtitulo: "Album preview", progreso: "62%" },
      { id: 3, titulo: "Luces bajas", subtitulo: "Sesion en vivo", progreso: "48%" },
    ],
  },
  "santo-beat": {
    artista: "Santo Beat",
    usuario: "@santobeat",
    oyentes: "8.7K",
    ciudad: "Cordoba",
    bio: "Trap, soul y percusiones latinas en demos crudas para tocar en vivo.",
    colorA: "#3cff00",
    colorB: "#023b22",
    publicaciones: [
      { id: 1, titulo: "Pulso lento", subtitulo: "Single", progreso: "51%" },
      { id: 2, titulo: "Sala roja", subtitulo: "EP", progreso: "22%" },
      { id: 3, titulo: "Cae la noche", subtitulo: "Remix", progreso: "70%" },
    ],
  },
  "marea-gris": {
    artista: "Marea Gris",
    usuario: "@mareagris",
    oyentes: "21.4K",
    ciudad: "Rosario",
    bio: "Rock alternativo con guitarras densas, bateria seca y un estribillo directo.",
    colorA: "#aa3bff",
    colorB: "#3157ff",
    publicaciones: [
      { id: 1, titulo: "Antes del final", subtitulo: "Demo", progreso: "22%" },
      { id: 2, titulo: "Paredes de humo", subtitulo: "Album", progreso: "58%" },
      { id: 3, titulo: "Cables quemados", subtitulo: "Ensayo", progreso: "44%" },
    ],
  },
};

const tabs = [
  { id: "musica", label: "Musica" },
  { id: "eventos", label: "Eventos" },
  { id: "favoritos", label: "Favoritos" },
];

export default function OtroPerfil() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [siguiendo, setSiguiendo] = useState(false);
  const [tabActiva, setTabActiva] = useState("musica");

  const perfil = useMemo(() => {
    const artistaState = location.state?.artista;
    const slug =
      searchParams.get("artista") ||
      artistaState?.artista?.toLowerCase().replaceAll(" ", "-") ||
      "luna-norte";

    return {
      ...perfilesBase[slug],
      ...artistaState,
      usuario:
        perfilesBase[slug]?.usuario ||
        artistaState?.usuario ||
        `@${(artistaState?.artista || "artista").toLowerCase().replaceAll(" ", "")}`,
      ciudad: perfilesBase[slug]?.ciudad || "Argentina",
      publicaciones: perfilesBase[slug]?.publicaciones || [
        {
          id: 1,
          titulo: artistaState?.tema || "Nueva demo",
          subtitulo: artistaState?.album || "Lanzamiento",
          progreso: `${artistaState?.progreso || 40}%`,
        },
      ],
    };
  }, [location.state, searchParams]);

  const inicial = perfil.artista?.charAt(0).toUpperCase() || "S";

  return (
    <section
      className="otroperfil-page"
      style={{
        "--perfil-a": perfil.colorA || "#ffae00",
        "--perfil-b": perfil.colorB || "#ff5e00",
      }}
    >
      <header className="otroperfil-hero">
        <div className="otroperfil-avatar" aria-hidden="true">
          {inicial}
        </div>

        <div className="otroperfil-info">
          <span className="otroperfil-handle">{perfil.usuario}</span>
          <h1>{perfil.artista}</h1>
          <p>{perfil.bio || perfil.descripcion}</p>

          <div className="otroperfil-stats" aria-label="Estadisticas del artista">
            <span>
              <strong>{perfil.oyentes || "0"}</strong>
              oyentes
            </span>
            <span>
              <strong>24</strong>
              demos
            </span>
            <span>
              <strong>{perfil.ciudad}</strong>
              ciudad
            </span>
          </div>

          <div className="otroperfil-actions">
            <button
              className={`otroperfil-follow ${siguiendo ? "activo" : ""}`}
              type="button"
              onClick={() => setSiguiendo((actual) => !actual)}
            >
              {siguiendo ? "Siguiendo" : "Seguir"}
            </button>
            <button className="otroperfil-message" type="button">
              Mensaje
            </button>
          </div>
        </div>
      </header>

      <nav className="otroperfil-tabs" aria-label="Contenido del perfil">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tabActiva === tab.id ? "activo" : ""}
            type="button"
            onClick={() => setTabActiva(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="otroperfil-content">
        {tabActiva === "musica" ? (
          <div className="otroperfil-grid">
            {perfil.publicaciones.map((publicacion) => (
              <article className="otroperfil-track" key={publicacion.id}>
                <div className="otroperfil-cover">
                  <span>{publicacion.titulo.charAt(0)}</span>
                </div>
                <div>
                  <h2>{publicacion.titulo}</h2>
                  <p>{publicacion.subtitulo}</p>
                  <div className="otroperfil-progress">
                    <span style={{ width: publicacion.progreso }} />
                  </div>
                </div>
                <button type="button" aria-label={`Reproducir ${publicacion.titulo}`}>
                  ▶
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="otroperfil-empty">Todavia no hay contenido en esta seccion.</p>
        )}
      </div>
    </section>
  );
}
