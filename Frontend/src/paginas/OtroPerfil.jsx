import { useState } from "react";
import { useParams } from "react-router-dom";

const perfiles = {
  mareagris: {
    nombre: "Marea Gris",
    usuario: "@mareagris",
    bio: "Rock alternativo con guitarras densas, bateria seca y canciones pensadas para sonar fuerte en vivo.",
    colorA: "#aa3bff",
    colorB: "#3157ff",
    stats: [
      { label: "Oyentes", valor: "21.4K" },
      { label: "Seguidores", valor: "48.2K" },
      { label: "Shows", valor: "32" },
    ],
    tracks: [
      { id: 1, nombre: "Antes del final", detalle: "Paredes de humo · 4:11", cover: "A" },
      { id: 2, nombre: "Luz de corte", detalle: "Single · 3:36", cover: "L" },
      { id: 3, nombre: "Ciudad de sal", detalle: "Demo en vivo · 5:02", cover: "C" },
    ],
  },
};

export default function OtroPerfil() {
  const { usuario } = useParams();
  const perfil = perfiles[usuario] || perfiles.mareagris;
  const [siguiendo, setSiguiendo] = useState(true);
  const [tab, setTab] = useState("tracks");

  return (
    <section
      className="otroperfil-page"
      style={{ "--perfil-a": perfil.colorA, "--perfil-b": perfil.colorB }}
    >
      <div className="otroperfil-hero">
        <div className="otroperfil-avatar">{perfil.nombre.charAt(0)}</div>

        <div className="otroperfil-info">
          <span className="otroperfil-handle">{perfil.usuario}</span>
          <h1>{perfil.nombre}</h1>
          <p>{perfil.bio}</p>

          <div className="otroperfil-stats">
            {perfil.stats.map((item) => (
              <span key={item.label}>
                {item.label}
                <strong>{item.valor}</strong>
              </span>
            ))}
          </div>

          <div className="otroperfil-actions">
            <button
              type="button"
              className={`otroperfil-follow ${siguiendo ? "activo" : ""}`}
              onClick={() => setSiguiendo((value) => !value)}
            >
              {siguiendo ? "Siguiendo" : "Seguir"}
            </button>
            <button type="button" className="otroperfil-message">Mensaje</button>
          </div>
        </div>
      </div>

      <div className="otroperfil-tabs">
        <button type="button" className={tab === "tracks" ? "activo" : ""} onClick={() => setTab("tracks")}>
          Tracks
        </button>
        <button type="button" className={tab === "about" ? "activo" : ""} onClick={() => setTab("about")}>
          Acerca
        </button>
      </div>

      <div className="otroperfil-content">
        {tab === "tracks" ? (
          <div className="otroperfil-grid">
            {perfil.tracks.map((track) => (
              <article className="otroperfil-track" key={track.id}>
                <div className="otroperfil-cover">{track.cover}</div>
                <div>
                  <h2>{track.nombre}</h2>
                  <p>{track.detalle}</p>
                </div>
                <button type="button">Play</button>
              </article>
            ))}
          </div>
        ) : (
          <div className="otroperfil-empty">Perfil artistico en construccion.</div>
        )}
      </div>
    </section>
  );
}
