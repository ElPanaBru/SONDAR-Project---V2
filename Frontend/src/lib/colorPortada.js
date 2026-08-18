export const COLOR_PORTADA_PREDETERMINADO = "#ffae00";

const COLOR_HEX_COMPLETO = /^#[0-9a-f]{6}$/i;
const TAMANO_MUESTRA = 40;

function limitar(valor, minimo = 0, maximo = 255) {
  return Math.min(maximo, Math.max(minimo, Math.round(valor)));
}

function canalAHex(valor) {
  return limitar(valor).toString(16).padStart(2, "0");
}

function rgbAHex(rojo, verde, azul) {
  return `#${canalAHex(rojo)}${canalAHex(verde)}${canalAHex(azul)}`;
}

function hexARgb(color) {
  const normalizado = normalizarColorPortada(color);
  return {
    rojo: Number.parseInt(normalizado.slice(1, 3), 16),
    verde: Number.parseInt(normalizado.slice(3, 5), 16),
    azul: Number.parseInt(normalizado.slice(5, 7), 16),
  };
}

export function normalizarColorPortada(color, respaldo = COLOR_PORTADA_PREDETERMINADO) {
  const valor = String(color || "").trim();
  return COLOR_HEX_COMPLETO.test(valor) ? valor.toLowerCase() : respaldo;
}

export function mezclarColores(color, destino = "#080808", proporcion = 0.65) {
  const base = hexARgb(color);
  const mezcla = hexARgb(destino);
  const peso = Math.min(1, Math.max(0, Number(proporcion) || 0));
  return rgbAHex(
    base.rojo + (mezcla.rojo - base.rojo) * peso,
    base.verde + (mezcla.verde - base.verde) * peso,
    base.azul + (mezcla.azul - base.azul) * peso
  );
}

function ajustarColorVisible(rojo, verde, azul) {
  const luminosidad = 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
  if (luminosidad < 46) {
    const proporcion = Math.min(0.38, (54 - luminosidad) / 100);
    return [
      rojo + (255 - rojo) * proporcion,
      verde + (255 - verde) * proporcion,
      azul + (255 - azul) * proporcion,
    ];
  }
  if (luminosidad > 218) {
    return [rojo * 0.78, verde * 0.78, azul * 0.78];
  }
  return [rojo, verde, azul];
}

export function seleccionarColorDominante(datos) {
  if (!datos?.length) return COLOR_PORTADA_PREDETERMINADO;

  const grupos = new Map();
  let respaldoRojo = 0;
  let respaldoVerde = 0;
  let respaldoAzul = 0;
  let respaldoCantidad = 0;

  for (let indice = 0; indice < datos.length; indice += 4) {
    const alfa = datos[indice + 3];
    if (alfa < 160) continue;

    const rojo = datos[indice];
    const verde = datos[indice + 1];
    const azul = datos[indice + 2];
    const maximo = Math.max(rojo, verde, azul);
    const minimo = Math.min(rojo, verde, azul);
    const luminosidad = 0.2126 * rojo + 0.7152 * verde + 0.0722 * azul;
    const saturacion = maximo === 0 ? 0 : (maximo - minimo) / maximo;

    if (luminosidad > 14 && luminosidad < 242) {
      respaldoRojo += rojo;
      respaldoVerde += verde;
      respaldoAzul += azul;
      respaldoCantidad += 1;
    }

    if (luminosidad < 24 || luminosidad > 236 || saturacion < 0.1) continue;

    const clave = `${rojo >> 5}-${verde >> 5}-${azul >> 5}`;
    const grupo = grupos.get(clave) || {
      rojo: 0,
      verde: 0,
      azul: 0,
      cantidad: 0,
      puntuacion: 0,
    };
    grupo.rojo += rojo;
    grupo.verde += verde;
    grupo.azul += azul;
    grupo.cantidad += 1;
    grupo.puntuacion += 0.72 + saturacion * 1.45;
    grupos.set(clave, grupo);
  }

  let dominante = null;
  grupos.forEach((grupo) => {
    if (!dominante || grupo.puntuacion > dominante.puntuacion) dominante = grupo;
  });

  const fuente = dominante || (respaldoCantidad
    ? {
        rojo: respaldoRojo,
        verde: respaldoVerde,
        azul: respaldoAzul,
        cantidad: respaldoCantidad,
      }
    : null);
  if (!fuente) return COLOR_PORTADA_PREDETERMINADO;

  const ajustado = ajustarColorVisible(
    fuente.rojo / fuente.cantidad,
    fuente.verde / fuente.cantidad,
    fuente.azul / fuente.cantidad
  );
  return rgbAHex(...ajustado);
}

function cargarImagen(origen) {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    let urlTemporal = "";

    imagen.onload = () => {
      resolve({ imagen, liberar: () => urlTemporal && URL.revokeObjectURL(urlTemporal) });
    };
    imagen.onerror = () => {
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
      reject(new Error("No se pudo analizar la portada."));
    };

    if (origen instanceof Blob) {
      urlTemporal = URL.createObjectURL(origen);
      imagen.src = urlTemporal;
    } else {
      imagen.crossOrigin = "anonymous";
      imagen.src = String(origen || "");
    }
  });
}

export async function extraerColorDominante(origen) {
  if (!origen || typeof document === "undefined") return COLOR_PORTADA_PREDETERMINADO;

  const { imagen, liberar } = await cargarImagen(origen);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = TAMANO_MUESTRA;
    canvas.height = TAMANO_MUESTRA;
    const contexto = canvas.getContext("2d", { willReadFrequently: true });
    if (!contexto) return COLOR_PORTADA_PREDETERMINADO;

    const ancho = imagen.naturalWidth || imagen.width;
    const alto = imagen.naturalHeight || imagen.height;
    const lado = Math.min(ancho, alto);
    const origenX = Math.max(0, (ancho - lado) / 2);
    const origenY = Math.max(0, (alto - lado) / 2);
    contexto.drawImage(
      imagen,
      origenX,
      origenY,
      lado,
      lado,
      0,
      0,
      TAMANO_MUESTRA,
      TAMANO_MUESTRA
    );
    return seleccionarColorDominante(
      contexto.getImageData(0, 0, TAMANO_MUESTRA, TAMANO_MUESTRA).data
    );
  } finally {
    liberar();
  }
}

export async function extraerColorDominanteDesdeUrl(
  url,
  { signal, usarRespaldoEnError = true } = {}
) {
  if (!url) return COLOR_PORTADA_PREDETERMINADO;
  try {
    const response = await fetch(url, { cache: "force-cache", mode: "cors", signal });
    if (!response.ok) throw new Error("No se pudo descargar la portada.");
    if (signal?.aborted) throw new DOMException("Analisis cancelado.", "AbortError");
    const archivo = await response.blob();
    if (signal?.aborted) throw new DOMException("Analisis cancelado.", "AbortError");
    const color = await extraerColorDominante(archivo);
    if (signal?.aborted) throw new DOMException("Analisis cancelado.", "AbortError");
    return color;
  } catch (error) {
    if (error?.name === "AbortError" || !usarRespaldoEnError) throw error;
    return COLOR_PORTADA_PREDETERMINADO;
  }
}
