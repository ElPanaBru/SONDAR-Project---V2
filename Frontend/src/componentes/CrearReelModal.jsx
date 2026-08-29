import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api";
import {
  COLOR_PORTADA_PREDETERMINADO,
  extraerColorDominante,
  normalizarColorPortada,
} from "../lib/colorPortada";
import {
  MAX_FRAGMENTO_SEGUNDOS,
  MIN_FRAGMENTO_SEGUNDOS,
  decodificarArchivoAudio,
  duracionReelDesdeSegundos,
  extraerPicosAudio,
  formatearTiempoAudio,
  recortarAudioComoWav,
  seleccionInicialAudio,
} from "../lib/audioFragmento";
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
  "alternativo",
  "punk",
  "reggae",
  "latina",
  "otros",
];
const MAX_GENEROS_REEL = 3;
const ETIQUETAS_GENERO_REEL = {
  edm: "Electronica",
  trap: "Urbano",
};
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

const crearSelectorAudioVacio = () => ({
  cargando: false,
  duracionTotal: 0,
  inicio: 0,
  fin: 0,
  actual: 0,
  picos: [],
  reproduciendo: false,
});

const crearReelVacio = () => ({
  titulo: "",
  generos: [],
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
  return ETIQUETAS_GENERO_REEL[genero]
    || genero.charAt(0).toUpperCase() + genero.slice(1);
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
  const [selectorAudio, setSelectorAudio] = useState(crearSelectorAudioVacio);
  const [archivoArrastrado, setArchivoArrastrado] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState("");
  const portadaInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const audioBufferRef = useRef(null);
  const subiendoRef = useRef(false);
  const versionSeleccionPortadaRef = useRef(0);
  const versionSeleccionAudioRef = useRef(0);

  useEffect(() => {
    if (!abierto) {
      versionSeleccionPortadaRef.current += 1;
      versionSeleccionAudioRef.current += 1;
    }
  }, [abierto]);

  useEffect(() => () => {
    versionSeleccionPortadaRef.current += 1;
    versionSeleccionAudioRef.current += 1;
  }, []);

  const cerrar = () => {
    if (subiendoRef.current) return;
    versionSeleccionPortadaRef.current += 1;
    versionSeleccionAudioRef.current += 1;
    audioPreviewRef.current?.pause();
    audioBufferRef.current = null;
    if (nuevoReel.audio?.startsWith("blob:")) URL.revokeObjectURL(nuevoReel.audio);
    if (portadaInputRef.current) portadaInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    setNuevoReel(crearReelVacio());
    setSelectorAudio(crearSelectorAudioVacio());
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

  const seleccionarAudio = async (seleccionado) => {
    if (!seleccionado) return;
    const versionSeleccion = ++versionSeleccionAudioRef.current;
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

    audioPreviewRef.current?.pause();
    audioBufferRef.current = null;
    setSelectorAudio({ ...crearSelectorAudioVacio(), cargando: true });
    setNuevoReel((actual) => {
      if (actual.audio?.startsWith("blob:")) URL.revokeObjectURL(actual.audio);
      return {
        ...actual,
        audio: "",
        audioFile: null,
        nombreAudio: archivo.name,
        duracion: "0:30",
      };
    });
    setAviso("");
    try {
      const audioBuffer = await decodificarArchivoAudio(archivo);
      if (versionSeleccion !== versionSeleccionAudioRef.current) return;
      const audio = URL.createObjectURL(archivo);
      const seleccion = seleccionInicialAudio(audioBuffer.duration);
      audioBufferRef.current = audioBuffer;
      setNuevoReel((actual) => {
        if (actual.audio?.startsWith("blob:")) URL.revokeObjectURL(actual.audio);
        return {
          ...actual,
          audio,
          audioFile: archivo,
          nombreAudio: archivo.name,
          duracion: duracionReelDesdeSegundos(seleccion.fin - seleccion.inicio),
        };
      });
      setSelectorAudio({
        cargando: false,
        duracionTotal: audioBuffer.duration,
        inicio: seleccion.inicio,
        fin: seleccion.fin,
        actual: seleccion.inicio,
        picos: extraerPicosAudio(audioBuffer),
        reproduciendo: false,
      });
    } catch (error) {
      if (versionSeleccion !== versionSeleccionAudioRef.current) return;
      audioBufferRef.current = null;
      if (audioInputRef.current) audioInputRef.current.value = "";
      setNuevoReel((actual) => ({
        ...actual,
        audio: "",
        audioFile: null,
        nombreAudio: "",
        duracion: "0:30",
      }));
      setSelectorAudio(crearSelectorAudioVacio());
      setAviso(error.message || "El archivo no contiene un audio reproducible.");
    }
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
    versionSeleccionAudioRef.current += 1;
    audioPreviewRef.current?.pause();
    audioBufferRef.current = null;
    if (audioInputRef.current) audioInputRef.current.value = "";
    setNuevoReel((actual) => {
      if (actual.audio?.startsWith("blob:")) URL.revokeObjectURL(actual.audio);
      return { ...actual, audio: "", audioFile: null, nombreAudio: "", duracion: "0:30" };
    });
    setSelectorAudio(crearSelectorAudioVacio());
  };

  const aplicarSeleccionAudio = (inicio, fin) => {
    const audio = audioPreviewRef.current;
    audio?.pause();
    if (audio?.readyState) audio.currentTime = inicio;
    setSelectorAudio((actual) => ({
      ...actual,
      inicio,
      fin,
      actual: inicio,
      reproduciendo: false,
    }));
    setNuevoReel((actual) => ({
      ...actual,
      duracion: duracionReelDesdeSegundos(fin - inicio),
    }));
  };

  const cambiarInicioAudio = (valor) => {
    const minimo = Math.min(MIN_FRAGMENTO_SEGUNDOS, selectorAudio.duracionTotal);
    const inicio = Math.max(0, Math.min(Number(valor), selectorAudio.fin - minimo));
    const fin = Math.min(selectorAudio.fin, inicio + MAX_FRAGMENTO_SEGUNDOS);
    aplicarSeleccionAudio(inicio, fin);
  };

  const cambiarFinAudio = (valor) => {
    const minimo = Math.min(MIN_FRAGMENTO_SEGUNDOS, selectorAudio.duracionTotal);
    const fin = Math.min(
      selectorAudio.duracionTotal,
      Math.max(Number(valor), selectorAudio.inicio + minimo),
      selectorAudio.inicio + MAX_FRAGMENTO_SEGUNDOS
    );
    aplicarSeleccionAudio(selectorAudio.inicio, fin);
  };

  const alternarReproduccionAudio = async () => {
    const audio = audioPreviewRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setSelectorAudio((actual) => ({ ...actual, reproduciendo: false }));
      return;
    }
    try {
      if (audio.readyState === 0) {
        await new Promise((resolve, reject) => {
          const listo = () => {
            audio.removeEventListener("error", fallo);
            resolve();
          };
          const fallo = () => {
            audio.removeEventListener("loadedmetadata", listo);
            reject(new Error("No se pudo cargar la vista previa del audio."));
          };
          audio.addEventListener("loadedmetadata", listo, { once: true });
          audio.addEventListener("error", fallo, { once: true });
        });
      }
      if (audio.currentTime < selectorAudio.inicio || audio.currentTime >= selectorAudio.fin - 0.03) {
        audio.currentTime = selectorAudio.inicio;
      }
      await audio.play();
      setSelectorAudio((actual) => ({ ...actual, reproduciendo: true }));
    } catch {
      setAviso("No se pudo reproducir el fragmento seleccionado.");
    }
  };

  const actualizarProgresoAudio = (event) => {
    const audio = event.currentTarget;
    if (audio.currentTime >= selectorAudio.fin - 0.025) {
      audio.pause();
      audio.currentTime = selectorAudio.inicio;
      setSelectorAudio((actual) => ({
        ...actual,
        actual: actual.inicio,
        reproduciendo: false,
      }));
      return;
    }
    setSelectorAudio((actual) => ({ ...actual, actual: audio.currentTime }));
  };

  const alternarGenero = (genero) => {
    setNuevoReel((actual) => {
      if (actual.generos.includes(genero)) {
        return { ...actual, generos: actual.generos.filter((item) => item !== genero) };
      }
      if (actual.generos.length >= MAX_GENEROS_REEL) return actual;
      return { ...actual, generos: [...actual.generos, genero] };
    });
  };

  const publicar = async (event) => {
    event.preventDefault();
    if (subiendoRef.current) return;
    if (!nuevoReel.titulo.trim() || nuevoReel.generos.length === 0 || !nuevoReel.audioFile) {
      setAviso("Completa el titulo, elegi al menos un genero y selecciona un audio.");
      return;
    }

    subiendoRef.current = true;
    setSubiendo(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Tu sesion expiro. Volve a iniciar sesion.");
      if (!audioBufferRef.current || selectorAudio.fin <= selectorAudio.inicio) {
        throw new Error("Espera a que termine de procesarse el audio y elegi un fragmento.");
      }

      const audioRecortado = recortarAudioComoWav(
        audioBufferRef.current,
        selectorAudio.inicio,
        selectorAudio.fin,
        nuevoReel.audioFile.name
      );
      if (audioRecortado.size > MAX_AUDIO_REEL_BYTES) {
        throw new Error("El fragmento generado supera los 20MB. Selecciona una parte mas corta.");
      }

      const formData = new FormData();
      formData.append("titulo", nuevoReel.titulo.trim());
      formData.append("genero", nuevoReel.generos[0]);
      formData.append("generos", JSON.stringify(nuevoReel.generos));
      formData.append("duracion", duracionReelDesdeSegundos(selectorAudio.fin - selectorAudio.inicio));
      formData.append("audio", audioRecortado);
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
      if (!response.ok) throw new Error(body.error || "No se pudo guardar la preview.");

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
      window.dispatchEvent(new CustomEvent("sondar:comunidad-perfil-actualizada"));
      if (nuevoReel.audio?.startsWith("blob:")) URL.revokeObjectURL(nuevoReel.audio);
      audioPreviewRef.current?.pause();
      audioBufferRef.current = null;
      if (portadaInputRef.current) portadaInputRef.current.value = "";
      if (audioInputRef.current) audioInputRef.current.value = "";
      versionSeleccionPortadaRef.current += 1;
      versionSeleccionAudioRef.current += 1;
      setNuevoReel(crearReelVacio());
      setSelectorAudio(crearSelectorAudioVacio());
      setArchivoArrastrado(null);
      onClose();
      setAviso("Preview publicada");
    } catch (error) {
      console.error(error);
      setAviso(error.message || "No se pudo guardar la preview.");
    } finally {
      subiendoRef.current = false;
      setSubiendo(false);
    }
  };

  const porcentajeAudio = (valor) => selectorAudio.duracionTotal > 0
    ? `${Math.min(100, Math.max(0, (valor / selectorAudio.duracionTotal) * 100))}%`
    : "0%";
  const duracionFragmento = Math.max(0, selectorAudio.fin - selectorAudio.inicio);

  return (
    <>
      <PerfilToast mensaje={aviso} onClose={() => setAviso("")} duracion={2400} />
      {abierto ? (
        <div className="crear-reel-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && cerrar()}>
          <form className="crear-reel-modal" role="dialog" aria-modal="true" aria-labelledby="crear-reel-titulo" onSubmit={publicar} onMouseDown={(event) => event.stopPropagation()}>
            <header className="crear-reel-header">
              <div>
                <span>PREVIEWS</span>
                <h2 id="crear-reel-titulo">Crear nueva preview</h2>
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
                {nuevoReel.generos.length > 0 ? (
                  <div className="crear-reel-sellos" aria-label="Generos seleccionados">
                    {nuevoReel.generos.map((genero) => (
                      <span className="crear-reel-sello" key={genero}>{mostrarGenero(genero)}</span>
                    ))}
                  </div>
                ) : null}
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
                <section className="crear-reel-generos" aria-labelledby="crear-reel-generos-titulo">
                  <div className="crear-reel-generos-encabezado">
                    <span id="crear-reel-generos-titulo">Generos musicales</span>
                    <small>{nuevoReel.generos.length}/{MAX_GENEROS_REEL}</small>
                  </div>
                  <div className="crear-reel-generos-opciones" role="group" aria-label="Seleccionar hasta tres generos">
                    {GENEROS_REEL.map((genero) => {
                      const seleccionado = nuevoReel.generos.includes(genero);
                      const limiteAlcanzado = nuevoReel.generos.length >= MAX_GENEROS_REEL;
                      return (
                        <label
                          className={`crear-reel-genero-opcion ${seleccionado ? "seleccionado" : ""} ${!seleccionado && limiteAlcanzado ? "deshabilitado" : ""}`}
                          key={genero}
                        >
                          <input
                            type="checkbox"
                            checked={seleccionado}
                            disabled={!seleccionado && limiteAlcanzado}
                            onChange={() => alternarGenero(genero)}
                          />
                          <span>{mostrarGenero(genero)}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>

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

                {selectorAudio.cargando ? (
                  <div className="crear-reel-audio-cargando" role="status">
                    <span />
                    Analizando la forma de onda...
                  </div>
                ) : null}

                {nuevoReel.audio ? (
                  <section className="crear-reel-selector-audio" aria-labelledby="selector-audio-titulo">
                    <header className="crear-reel-selector-encabezado">
                      <div>
                        <strong id="selector-audio-titulo">Elegi el fragmento</strong>
                        <small>Arrastra los extremos · maximo {MAX_FRAGMENTO_SEGUNDOS} segundos</small>
                      </div>
                      <output>{formatearTiempoAudio(duracionFragmento, true)}</output>
                    </header>

                    <div className="crear-reel-editor-audio">
                      <button
                        className="crear-reel-audio-play"
                        type="button"
                        onClick={alternarReproduccionAudio}
                        aria-label={selectorAudio.reproduciendo ? "Pausar fragmento" : "Reproducir fragmento"}
                      >
                        {selectorAudio.reproduciendo ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
                        ) : (
                          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 4 13 8-13 8z" /></svg>
                        )}
                      </button>
                      <time>{formatearTiempoAudio(selectorAudio.inicio, true)}</time>

                      <div
                        className="crear-reel-linea-audio"
                        style={{
                          "--audio-inicio": porcentajeAudio(selectorAudio.inicio),
                          "--audio-fin": porcentajeAudio(selectorAudio.fin),
                          "--audio-progreso": porcentajeAudio(selectorAudio.actual),
                        }}
                      >
                        <div className="crear-reel-onda" aria-hidden="true">
                          {selectorAudio.picos.map((pico, indice) => (
                            <i key={indice} style={{ height: `${Math.max(8, pico * 100)}%` }} />
                          ))}
                        </div>
                        <span className="crear-reel-audio-sombra inicio" aria-hidden="true" />
                        <span className="crear-reel-audio-seleccion" aria-hidden="true" />
                        <span className="crear-reel-audio-sombra fin" aria-hidden="true" />
                        <span className="crear-reel-audio-cursor" aria-hidden="true" />
                        <input
                          className="crear-reel-audio-rango inicio"
                          type="range"
                          min="0"
                          max={selectorAudio.duracionTotal}
                          step="0.01"
                          value={selectorAudio.inicio}
                          onChange={(event) => cambiarInicioAudio(event.target.value)}
                          aria-label="Inicio del fragmento"
                          aria-valuetext={formatearTiempoAudio(selectorAudio.inicio, true)}
                        />
                        <input
                          className="crear-reel-audio-rango fin"
                          type="range"
                          min="0"
                          max={selectorAudio.duracionTotal}
                          step="0.01"
                          value={selectorAudio.fin}
                          onChange={(event) => cambiarFinAudio(event.target.value)}
                          aria-label="Fin del fragmento"
                          aria-valuetext={formatearTiempoAudio(selectorAudio.fin, true)}
                        />
                      </div>

                      <time>{formatearTiempoAudio(selectorAudio.fin, true)}</time>
                    </div>

                    <footer>
                      <span title={nuevoReel.nombreAudio}>{nuevoReel.nombreAudio}</span>
                      <small>Total: {formatearTiempoAudio(selectorAudio.duracionTotal)}</small>
                    </footer>
                    <audio
                      ref={audioPreviewRef}
                      src={nuevoReel.audio}
                      preload="metadata"
                      onTimeUpdate={actualizarProgresoAudio}
                      onPause={() => setSelectorAudio((actual) => ({ ...actual, reproduciendo: false }))}
                    />
                  </section>
                ) : null}
                <button className="crear-reel-publicar" type="submit" disabled={subiendo}>{subiendo ? "Creando..." : "Publicar preview"}</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
