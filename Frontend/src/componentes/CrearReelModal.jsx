import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import {
  COLOR_PORTADA_PREDETERMINADO,
  extraerColorDominante,
  normalizarColorPortada,
} from "../lib/colorPortada";
import { supabase } from "../lib/supabaseClient";
import PerfilToast from "./PerfilToast";
import "../paginas/descubrir.css";

const GENEROS_REEL = [
  "pop",
  "rock",
  "edm",
  "jazz",
  "blues",
  "cumbia",
  "trap",
  "metal",
  "folklore",
  "otros",
];
const MAX_PORTADA_REEL_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_REEL_BYTES = 20 * 1024 * 1024;
const MIME_PORTADA_POR_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};
const MIME_AUDIO_POR_EXTENSION = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  webm: "audio/webm",
  m4a: "audio/mp4",
};
const ACCEPT_PORTADA_REEL = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";
const ACCEPT_AUDIO_REEL = ".mp3,.wav,.ogg,.webm,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4";

const crearReelVacio = () => ({
  titulo: "",
  genero: "",
  portada: "",
  portadaFile: null,
  audio: "",
  audioFile: null,
  nombrePortada: "",
  nombreAudio: "",
  duracion: "0:30",
  colorPrincipal: COLOR_PORTADA_PREDETERMINADO,
});

function prepararArchivoReel(archivo, tiposPorExtension, maxBytes, etiqueta) {
  const extension = archivo.name.split(".").pop()?.toLowerCase() || "";
  const mimeEsperado = tiposPorExtension[extension];
  if (!mimeEsperado) throw new Error(`El formato de ${etiqueta} no esta permitido.`);
  if (archivo.size > maxBytes) {
    throw new Error(`El ${etiqueta} no puede superar los ${Math.round(maxBytes / (1024 * 1024))}MB.`);
  }

  const tiposCompatibles = new Set(Object.values(tiposPorExtension));
  const aliasesCompatibles = etiqueta === "audio"
    ? new Set(["audio/mp3", "audio/x-wav", "audio/wave", "audio/x-m4a"])
    : new Set();
  if (archivo.type && !tiposCompatibles.has(archivo.type) && !aliasesCompatibles.has(archivo.type)) {
    throw new Error(`El tipo declarado del ${etiqueta} no coincide con su extension.`);
  }

  if (archivo.type === mimeEsperado) return archivo;
  return new File([archivo], archivo.name, { type: mimeEsperado, lastModified: archivo.lastModified });
}

function mostrarGenero(genero) {
  if (!genero) return "";
  return genero === "edm" ? "EDM" : genero.charAt(0).toUpperCase() + genero.slice(1);
}

function usuarioVisible(usuario) {
  const nombre = usuario?.user_metadata?.username
    || usuario?.user_metadata?.name
    || usuario?.email?.split("@")[0]
    || "artista";
  return `@${String(nombre).replace(/^@/, "")}`;
}

function IconoCerrar() {
  return (
    <svg aria-hidden="true" viewBox="0 -960 960 960" fill="currentColor">
      <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
    </svg>
  );
}

export default function CrearReelModal({ abierto, usuario, onClose }) {
  const [nuevoReel, setNuevoReel] = useState(crearReelVacio);
  const [archivoArrastrado, setArchivoArrastrado] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const portadaInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const subiendoRef = useRef(false);
  const versionSeleccionPortadaRef = useRef(0);

  useEffect(() => {
    if (!abierto) versionSeleccionPortadaRef.current += 1;
  }, [abierto]);

  useEffect(() => () => {
    versionSeleccionPortadaRef.current += 1;
  }, []);

  const cerrar = () => {
    if (subiendoRef.current) return;
    versionSeleccionPortadaRef.current += 1;
    if (nuevoReel.audio?.startsWith("blob:")) URL.revokeObjectURL(nuevoReel.audio);
    if (portadaInputRef.current) portadaInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    setNuevoReel(crearReelVacio());
    setArchivoArrastrado(null);
    onClose();
  };

  const leerArchivo = (archivo) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(archivo);
  });

  const seleccionarPortada = async (seleccionado) => {
    const versionSeleccion = ++versionSeleccionPortadaRef.current;
    if (!seleccionado) return;
    try {
      const archivo = prepararArchivoReel(
        seleccionado,
        MIME_PORTADA_POR_EXTENSION,
        MAX_PORTADA_REEL_BYTES,
        "portada"
      );
      const [portada, colorPrincipal] = await Promise.all([
        leerArchivo(archivo),
        extraerColorDominante(archivo).catch(() => COLOR_PORTADA_PREDETERMINADO),
      ]);
      if (versionSeleccion !== versionSeleccionPortadaRef.current) return;
      setNuevoReel((actual) => ({
        ...actual,
        portada,
        portadaFile: archivo,
        nombrePortada: archivo.name,
        colorPrincipal,
      }));
    } catch (error) {
      if (versionSeleccion !== versionSeleccionPortadaRef.current) return;
      if (portadaInputRef.current) portadaInputRef.current.value = "";
      setAviso(error.message || "No se pudo leer la portada seleccionada.");
    }
  };

  const seleccionarAudio = (seleccionado) => {
    if (!seleccionado) return;
    let archivo;
    try {
      archivo = prepararArchivoReel(
        seleccionado,
        MIME_AUDIO_POR_EXTENSION,
        MAX_AUDIO_REEL_BYTES,
        "audio"
      );
    } catch (error) {
      if (audioInputRef.current) audioInputRef.current.value = "";
      setAviso(error.message || "No se pudo leer el audio seleccionado.");
      return;
    }

    const audio = URL.createObjectURL(archivo);
    const elementoAudio = new Audio(audio);
    setNuevoReel((actual) => {
      if (actual.audio?.startsWith("blob:")) URL.revokeObjectURL(actual.audio);
      return {
        ...actual,
        audio,
        audioFile: archivo,
        nombreAudio: archivo.name,
        duracion: "0:30",
      };
    });
    elementoAudio.addEventListener("loadedmetadata", () => {
      const total = Number.isFinite(elementoAudio.duration) ? Math.max(1, Math.round(elementoAudio.duration)) : 30;
      const duracion = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
      setNuevoReel((actual) => actual.audio === audio ? { ...actual, duracion } : actual);
    }, { once: true });
    elementoAudio.addEventListener("error", () => {
      URL.revokeObjectURL(audio);
      if (audioInputRef.current) audioInputRef.current.value = "";
      setNuevoReel((actual) => actual.audio === audio
        ? { ...actual, audio: "", audioFile: null, nombreAudio: "", duracion: "0:30" }
        : actual
      );
      setAviso("El archivo no contiene un audio reproducible.");
    }, { once: true });
  };

  const prepararArrastre = (event, tipo) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setArchivoArrastrado(tipo);
  };

  const salirArrastre = (event, tipo) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setArchivoArrastrado((actual) => actual === tipo ? null : actual);
    }
  };

  const soltarArchivo = (event, tipo) => {
    event.preventDefault();
    event.stopPropagation();
    setArchivoArrastrado(null);
    const archivo = event.dataTransfer.files?.[0];
    if (tipo === "portada") seleccionarPortada(archivo);
    if (tipo === "audio") seleccionarAudio(archivo);
  };

  const limpiarPortada = () => {
    versionSeleccionPortadaRef.current += 1;
    if (portadaInputRef.current) portadaInputRef.current.value = "";
    setNuevoReel((actual) => ({
      ...actual,
      portada: "",
      portadaFile: null,
      nombrePortada: "",
      colorPrincipal: COLOR_PORTADA_PREDETERMINADO,
    }));
  };

  const limpiarAudio = () => {
    if (audioInputRef.current) audioInputRef.current.value = "";
    setNuevoReel((actual) => {
      if (actual.audio?.startsWith("blob:")) URL.revokeObjectURL(actual.audio);
      return { ...actual, audio: "", audioFile: null, nombreAudio: "", duracion: "0:30" };
    });
  };

  const publicar = async (event) => {
    event.preventDefault();
    if (subiendoRef.current) return;
    if (!nuevoReel.titulo.trim() || !nuevoReel.genero || !nuevoReel.audioFile) {
      setAviso("Completa el titulo, el genero y selecciona un audio.");
      return;
    }

    subiendoRef.current = true;
    setSubiendo(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion expiro. Volve a iniciar sesion.");

      const formData = new FormData();
      formData.append("titulo", nuevoReel.titulo.trim());
      formData.append("genero", nuevoReel.genero);
      formData.append("duracion", nuevoReel.duracion);
      formData.append("audio", nuevoReel.audioFile);
      if (nuevoReel.portadaFile) {
        formData.append("portada", nuevoReel.portadaFile);
        formData.append("color_principal", normalizarColorPortada(nuevoReel.colorPrincipal));
      }

      const response = await apiRequest("/api/reels/crear", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo guardar el reel.");

      let reel = {
        ...body,
        id: `db-${body.id}`,
        backendId: body.backendId || body.id,
      };
      if (!reel.avatar) {
        const perfilResponse = await apiRequest("/api/usuarios/me/perfil", {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null);
        if (perfilResponse?.ok) {
          const perfilData = await perfilResponse.json();
          reel = { ...reel, avatar: perfilData.perfil?.avatar || "" };
        }
      }

      window.dispatchEvent(new CustomEvent("sondar:reel-creado", { detail: reel }));
      if (nuevoReel.audio?.startsWith("blob:")) URL.revokeObjectURL(nuevoReel.audio);
      if (portadaInputRef.current) portadaInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
      versionSeleccionPortadaRef.current += 1;
      setNuevoReel(crearReelVacio());
      setArchivoArrastrado(null);
      onClose();
      setAviso("Reel publicado");
    } catch (error) {
      console.error(error);
      setAviso(error.message || "No se pudo guardar el reel.");
    } finally {
      subiendoRef.current = false;
      setSubiendo(false);
    }
  };

  return (
    <>
      <PerfilToast mensaje={aviso} onClose={() => setAviso("")} duracion={2400} />
      {abierto ? (
        <div className="crear-reel-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cerrar()}>
          <form className="crear-reel-modal" role="dialog" aria-modal="true" aria-labelledby="crear-reel-titulo" onSubmit={publicar} onMouseDown={(event) => event.stopPropagation()}>
            <header className="crear-reel-header">
              <div>
                <span>REELS</span>
                <h2 id="crear-reel-titulo">Crear nuevo reel</h2>
              </div>
              <button type="button" onClick={cerrar} aria-label="Cerrar" disabled={subiendo}>
                <IconoCerrar />
              </button>
            </header>

            <div className="crear-reel-contenido">
              <div
                className={`crear-reel-preview ${nuevoReel.portada ? "con-portada" : ""} ${archivoArrastrado === "portada" ? "archivo-arrastrado" : ""}`}
                style={{
                  "--color-portada": nuevoReel.colorPrincipal,
                  ...(nuevoReel.portada ? { backgroundImage: `url(${nuevoReel.portada})` } : {}),
                }}
                onDragEnter={(event) => prepararArrastre(event, "portada")}
                onDragOver={(event) => prepararArrastre(event, "portada")}
                onDragLeave={(event) => salirArrastre(event, "portada")}
                onDrop={(event) => soltarArchivo(event, "portada")}
              >
                {nuevoReel.genero ? <span className="crear-reel-sello">{mostrarGenero(nuevoReel.genero)}</span> : null}
                <div className="crear-reel-preview-copy">
                  <strong>{nuevoReel.titulo || "Titulo de la cancion"}</strong>
                  <small>{usuarioVisible(usuario)}</small>
                </div>
              </div>

              <div className="crear-reel-campos">
                <label>
                  Titulo de la cancion
                  <input value={nuevoReel.titulo} onChange={(event) => setNuevoReel((actual) => ({ ...actual, titulo: event.target.value }))} maxLength="50" placeholder="Ej: Neon de madrugada" required />
                </label>
                <label>
                  Genero musical
                  <select value={nuevoReel.genero} onChange={(event) => setNuevoReel((actual) => ({ ...actual, genero: event.target.value }))} required>
                    <option value="" disabled>Seleccionar genero</option>
                    {GENEROS_REEL.map((genero) => <option key={genero} value={genero}>{mostrarGenero(genero)}</option>)}
                  </select>
                </label>

                {nuevoReel.portada ? (
                  <label className="crear-reel-color">
                    Color del ambiente
                    <span className="crear-reel-color-control">
                      <input
                        type="color"
                        value={nuevoReel.colorPrincipal}
                        aria-label="Color principal del fondo difuminado"
                        onChange={(event) =>
                          setNuevoReel((actual) => ({
                            ...actual,
                            colorPrincipal: normalizarColorPortada(event.target.value),
                          }))
                        }
                      />
                      <output>{nuevoReel.colorPrincipal.toUpperCase()}</output>
                    </span>
                    <small>Detectado automaticamente desde la portada. Podes ajustarlo.</small>
                  </label>
                ) : null}

                <div className="crear-reel-archivos">
                  <div className="crear-reel-archivo-grupo">
                    <label className={`crear-reel-archivo ${archivoArrastrado === "portada" ? "archivo-arrastrado" : ""}`} onDragEnter={(event) => prepararArrastre(event, "portada")} onDragOver={(event) => prepararArrastre(event, "portada")} onDragLeave={(event) => salirArrastre(event, "portada")} onDrop={(event) => soltarArchivo(event, "portada")}>
                      <span>Elegir o arrastrar portada</span>
                      <small>{nuevoReel.nombrePortada || "JPG, PNG, WEBP o GIF (max. 5MB)"}</small>
                      <input ref={portadaInputRef} type="file" accept={ACCEPT_PORTADA_REEL} onChange={(event) => seleccionarPortada(event.target.files?.[0])} />
                    </label>
                    {nuevoReel.nombrePortada ? <button className="crear-reel-limpiar" type="button" onClick={limpiarPortada}>Quitar portada</button> : null}
                  </div>
                  <div className="crear-reel-archivo-grupo">
                    <label className={`crear-reel-archivo ${archivoArrastrado === "audio" ? "archivo-arrastrado" : ""}`} onDragEnter={(event) => prepararArrastre(event, "audio")} onDragOver={(event) => prepararArrastre(event, "audio")} onDragLeave={(event) => salirArrastre(event, "audio")} onDrop={(event) => soltarArchivo(event, "audio")}>
                      <span>Elegir o arrastrar audio</span>
                      <small>{nuevoReel.nombreAudio || "MP3, WAV, OGG, WEBM o M4A (max. 20MB)"}</small>
                      <input ref={audioInputRef} type="file" accept={ACCEPT_AUDIO_REEL} onChange={(event) => seleccionarAudio(event.target.files?.[0])} aria-required="true" />
                    </label>
                    {nuevoReel.nombreAudio ? <button className="crear-reel-limpiar" type="button" onClick={limpiarAudio}>Quitar audio</button> : null}
                  </div>
                </div>

                {nuevoReel.audio ? <audio className="crear-reel-audio" src={nuevoReel.audio} controls /> : null}
                <button className="crear-reel-publicar" type="submit" disabled={subiendo}>{subiendo ? "Creando..." : "Publicar reel"}</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
