import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "../lib/api";
import "./onboardingPerfilModal.css";

const hoy = new Date();
const fechaMaxima = new Date(Date.UTC(hoy.getUTCFullYear() - 13, hoy.getUTCMonth(), hoy.getUTCDate()))
  .toISOString()
  .slice(0, 10);

const GENEROS = [
  ["pop", "✨", "Pop"],
  ["rock", "🎸", "Rock"],
  ["trap", "🎤", "Trap"],
  ["cumbia", "💃", "Cumbia"],
  ["edm", "🎧", "EDM"],
  ["jazz", "🎷", "Jazz"],
  ["blues", "🎵", "Blues"],
  ["metal", "🤘", "Metal"],
  ["folklore", "🪕", "Folklore"],
];

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export default function OnboardingPerfilModal({ token, username, onComplete }) {
  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [generos, setGeneros] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarArrastrado, setAvatarArrastrado] = useState(false);
  const preview = useMemo(() => avatar ? URL.createObjectURL(avatar) : "", [avatar]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowAnterior;
    };
  }, []);

  const seleccionarArchivoAvatar = (archivo, input = null) => {
    if (!archivo) {
      setAvatar(null);
      return;
    }
    if (!AVATAR_TYPES.has(archivo.type)) {
      if (input) input.value = "";
      setAvatar(null);
      setMensaje("Usa una foto JPG, PNG, WebP o GIF.");
      return;
    }
    if (archivo.size > AVATAR_MAX_BYTES) {
      if (input) input.value = "";
      setAvatar(null);
      setMensaje("La foto no puede superar los 5 MB.");
      return;
    }
    setAvatar(archivo);
    setMensaje("");
  };

  const seleccionarAvatar = (event) => {
    seleccionarArchivoAvatar(event.target.files?.[0] || null, event.target);
  };

  const soltarAvatar = (event) => {
    event.preventDefault();
    setAvatarArrastrado(false);
    seleccionarArchivoAvatar(event.dataTransfer.files?.[0] || null);
  };

  const guardar = async (event) => {
    event.preventDefault();
    if (nombre.trim().length < 2) {
      setMensaje("Ingresá el nombre que querés mostrar en tu perfil.");
      return;
    }
    if (!birthDate) {
      setMensaje("Elegí tu fecha de nacimiento para continuar.");
      return;
    }
    if (generos.length < 3) {
      setMensaje("Elegí al menos 3 géneros para personalizar Descubrir.");
      return;
    }

    setLoading(true);
    setMensaje("");
    try {
      const formData = new FormData();
      formData.append("nombre", nombre.trim());
      formData.append("bio", bio.trim());
      formData.append("birthDate", birthDate);
      formData.append("genres", JSON.stringify(generos));
      if (avatar) formData.append("avatar", avatar);

      const response = await apiRequest("/api/usuarios/me/onboarding", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "No se pudo completar tu perfil.");
      onComplete(data);
    } catch (error) {
      setMensaje(error.message || "No se pudo completar tu perfil.");
    } finally {
      setLoading(false);
    }
  };

  const alternarGenero = (genre) => {
    setGeneros((actuales) => actuales.includes(genre)
      ? actuales.filter((item) => item !== genre)
      : [...actuales, genre]
    );
    setMensaje("");
  };

  const modal = (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-step">ÚLTIMO PASO</div>
        <h2 id="onboarding-title">Dale identidad a tu perfil</h2>
        <p className="onboarding-intro">Tu foto ayuda a que te reconozcan. Tu fecha de nacimiento nunca será pública.</p>

        <form onSubmit={guardar} className="onboarding-form">
          <label
            className={`onboarding-avatar-picker ${avatarArrastrado ? "arrastrando" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setAvatarArrastrado(true); }}
            onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setAvatarArrastrado(false);
            }}
            onDrop={soltarAvatar}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={seleccionarAvatar}
            />
            <span className="onboarding-avatar-preview">
              {preview ? <img src={preview} alt="Vista previa del perfil" /> : <strong>{String(username || "S").charAt(0).toUpperCase()}</strong>}
              <span className="onboarding-camera" aria-hidden="true">+</span>
            </span>
            <span>{avatar ? "Cambiar o arrastrar otra foto" : "Elegir o arrastrar foto (opcional)"}</span>
            <small>JPG, PNG, WebP o GIF · máximo 5 MB</small>
          </label>

          <div className="onboarding-profile-fields">
            <label>
              <span>Nombre visible</span>
              <input
                type="text"
                value={nombre}
                maxLength={32}
                placeholder="Ej: Martina López"
                autoComplete="name"
                onChange={(event) => { setNombre(event.target.value); setMensaje(""); }}
                required
              />
              <small>Es tu nombre común, sin @. Tu usuario sigue siendo @{String(username || "usuario").replace(/^@/, "")}.</small>
            </label>

            <label>
              <span>Bio</span>
              <textarea
                value={bio}
                maxLength={180}
                rows={3}
                placeholder="Contá qué hacés, qué escuchás o qué estás creando."
                onChange={(event) => setBio(event.target.value)}
              />
              <small>{bio.length}/180</small>
            </label>
          </div>

          <label className="onboarding-date-field">
            <span>¿Cuál es tu fecha de nacimiento?</span>
            <input
              type="date"
              value={birthDate}
              max={fechaMaxima}
              min="1900-01-01"
              onChange={(event) => setBirthDate(event.target.value)}
              required
            />
            <small>Debés tener al menos 13 años. Esta información es privada.</small>
          </label>

          <fieldset className="onboarding-genres">
            <legend>¿Qué géneros te gustaría descubrir?</legend>
            <p>Elegí al menos 3. Los usaremos para ordenar tus recomendaciones.</p>
            <div className="onboarding-genre-grid">
              {GENEROS.map(([value, icon, label]) => {
                const activo = generos.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    className={activo ? "active" : ""}
                    aria-pressed={activo}
                    onClick={() => alternarGenero(value)}
                  >
                    <span aria-hidden="true">{icon}</span>{label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {mensaje ? <p className="onboarding-error">{mensaje}</p> : null}

          <button className="onboarding-submit" type="submit" disabled={loading || nombre.trim().length < 2 || !birthDate || generos.length < 3}>
            {loading ? "Guardando..." : `Entrar a SONDAR (${Math.min(generos.length, 3)}/3)`}
          </button>
        </form>
      </section>
    </div>
  );

  return createPortal(modal, document.body);
}
