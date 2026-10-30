import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FRAGMENTO_SEGUNDOS,
  duracionReelDesdeSegundos,
  extraerPicosAudio,
  formatearTiempoAudio,
  recortarAudioComoWav,
  seleccionInicialAudio,
} from "../src/lib/audioFragmento.js";

function audioBufferFalso({ duracion = 2, sampleRate = 8000, canales = 1 } = {}) {
  const length = Math.round(duracion * sampleRate);
  const datos = Array.from({ length: canales }, (_, canal) => {
    const muestras = new Float32Array(length);
    for (let indice = 0; indice < length; indice += 1) {
      muestras[indice] = Math.sin((indice / sampleRate) * Math.PI * (220 + canal * 110));
    }
    return muestras;
  });
  return {
    duration: duracion,
    sampleRate,
    numberOfChannels: canales,
    length,
    getChannelData: (canal) => datos[canal],
  };
}

test("la seleccion inicial usa todo el audio corto y limita los largos a 30 segundos", () => {
  assert.deepEqual(seleccionInicialAudio(12.4), { inicio: 0, fin: 12.4 });
  assert.deepEqual(seleccionInicialAudio(95), { inicio: 0, fin: MAX_FRAGMENTO_SEGUNDOS });
  assert.equal(duracionReelDesdeSegundos(12.4), "0:12");
  assert.equal(formatearTiempoAudio(75.239, true), "01:15.23");
});

test("la forma de onda produce picos normalizados", () => {
  const picos = extraerPicosAudio(audioBufferFalso(), 64);
  assert.equal(picos.length, 64);
  assert.ok(picos.every((pico) => pico >= 0.08 && pico <= 1));
});

test("el archivo publicado contiene solamente el fragmento elegido en WAV", async () => {
  const archivo = recortarAudioComoWav(audioBufferFalso(), 0.25, 1.25, "tema.mp3");
  assert.equal(archivo.name, "tema-fragmento.wav");
  assert.equal(archivo.type, "audio/wav");
  assert.equal(archivo.size, 44 + 8000 * 2);

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
});
