export const MAX_FRAGMENTO_SEGUNDOS = 30;
export const MIN_FRAGMENTO_SEGUNDOS = 1;

const limitar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

export function formatearTiempoAudio(segundos, incluirCentecimas = false) {
  const valor = Math.max(0, Number(segundos) || 0);
  const minutos = Math.floor(valor / 60);
  const segundosEnteros = Math.floor(valor % 60);
  const base = `${String(minutos).padStart(2, "0")}:${String(segundosEnteros).padStart(2, "0")}`;
  if (!incluirCentecimas) return base;
  const centesimas = Math.floor((valor - Math.floor(valor)) * 100);
  return `${base}.${String(centesimas).padStart(2, "0")}`;
}

export function duracionReelDesdeSegundos(segundos) {
  const total = Math.max(1, Math.round(Number(segundos) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function seleccionInicialAudio(duracionTotal) {
  const total = Math.max(0, Number(duracionTotal) || 0);
  return {
    inicio: 0,
    fin: Math.min(total, MAX_FRAGMENTO_SEGUNDOS),
  };
}

export function extraerPicosAudio(audioBuffer, cantidad = 96) {
  const totalPicos = Math.max(24, Math.round(cantidad));
  const canales = Array.from(
    { length: Math.min(audioBuffer.numberOfChannels || 1, 2) },
    (_, indice) => audioBuffer.getChannelData(indice)
  );
  const longitud = audioBuffer.length || canales[0]?.length || 0;
  if (!longitud || canales.length === 0) return Array(totalPicos).fill(0.08);

  const muestrasPorPico = Math.max(1, Math.floor(longitud / totalPicos));
  const picos = Array.from({ length: totalPicos }, (_, indicePico) => {
    const inicio = indicePico * muestrasPorPico;
    const fin = Math.min(longitud, inicio + muestrasPorPico);
    const salto = Math.max(1, Math.floor((fin - inicio) / 48));
    let maximo = 0;
    for (let muestra = inicio; muestra < fin; muestra += salto) {
      let amplitud = 0;
      for (const canal of canales) amplitud += Math.abs(canal[muestra] || 0);
      maximo = Math.max(maximo, amplitud / canales.length);
    }
    return maximo;
  });
  const maximoGlobal = Math.max(...picos, 0.001);
  return picos.map((pico) => limitar(Math.sqrt(pico / maximoGlobal), 0.08, 1));
}

export async function decodificarArchivoAudio(archivo) {
  const AudioContexto = window.AudioContext || window.webkitAudioContext;
  if (!AudioContexto) throw new Error("Tu navegador no permite editar audio.");
  const contexto = new AudioContexto();
  try {
    const datos = await archivo.arrayBuffer();
    const audioBuffer = await contexto.decodeAudioData(datos.slice(0));
    if (!Number.isFinite(audioBuffer.duration) || audioBuffer.duration <= 0) {
      throw new Error("El archivo no contiene un audio reproducible.");
    }
    return audioBuffer;
  } catch (error) {
    if (error?.message === "El archivo no contiene un audio reproducible.") throw error;
    throw new Error("No se pudo analizar este audio. Proba con MP3, WAV, OGG, WEBM o M4A.");
  } finally {
    await contexto.close().catch(() => null);
  }
}

function escribirTexto(dataView, offset, texto) {
  for (let indice = 0; indice < texto.length; indice += 1) {
    dataView.setUint8(offset + indice, texto.charCodeAt(indice));
  }
}

export function recortarAudioComoWav(audioBuffer, inicio, fin, nombreOriginal = "audio") {
  const inicioSeguro = limitar(Number(inicio) || 0, 0, audioBuffer.duration);
  const finSeguro = limitar(Number(fin) || 0, inicioSeguro, audioBuffer.duration);
  if (finSeguro <= inicioSeguro) throw new Error("Selecciona un fragmento de audio valido.");

  const canales = Math.min(Math.max(1, audioBuffer.numberOfChannels || 1), 2);
  const frecuenciaOrigen = audioBuffer.sampleRate;
  const frecuenciaSalida = Math.min(frecuenciaOrigen, 48000);
  const cuadrosSalida = Math.max(1, Math.round((finSeguro - inicioSeguro) * frecuenciaSalida));
  const bytesPorMuestra = 2;
  const alineacion = canales * bytesPorMuestra;
  const bufferSalida = new ArrayBuffer(44 + cuadrosSalida * alineacion);
  const vista = new DataView(bufferSalida);

  escribirTexto(vista, 0, "RIFF");
  vista.setUint32(4, 36 + cuadrosSalida * alineacion, true);
  escribirTexto(vista, 8, "WAVE");
  escribirTexto(vista, 12, "fmt ");
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);
  vista.setUint16(22, canales, true);
  vista.setUint32(24, frecuenciaSalida, true);
  vista.setUint32(28, frecuenciaSalida * alineacion, true);
  vista.setUint16(32, alineacion, true);
  vista.setUint16(34, 16, true);
  escribirTexto(vista, 36, "data");
  vista.setUint32(40, cuadrosSalida * alineacion, true);

  const datosCanales = Array.from({ length: canales }, (_, canal) => audioBuffer.getChannelData(canal));
  const cuadroInicial = inicioSeguro * frecuenciaOrigen;
  const relacionFrecuencias = frecuenciaOrigen / frecuenciaSalida;
  let offset = 44;
  for (let cuadro = 0; cuadro < cuadrosSalida; cuadro += 1) {
    const posicionOrigen = cuadroInicial + cuadro * relacionFrecuencias;
    const indiceOrigen = Math.floor(posicionOrigen);
    const mezcla = posicionOrigen - indiceOrigen;
    for (let canal = 0; canal < canales; canal += 1) {
      const datos = datosCanales[canal];
      const muestraA = datos[indiceOrigen] || 0;
      const muestraB = datos[Math.min(indiceOrigen + 1, datos.length - 1)] || muestraA;
      const muestra = limitar(muestraA + (muestraB - muestraA) * mezcla, -1, 1);
      vista.setInt16(offset, muestra < 0 ? muestra * 0x8000 : muestra * 0x7fff, true);
      offset += bytesPorMuestra;
    }
  }

  const baseNombre = String(nombreOriginal).replace(/\.[^.]+$/, "") || "audio";
  return new File([bufferSalida], `${baseNombre}-fragmento.wav`, { type: "audio/wav" });
}
