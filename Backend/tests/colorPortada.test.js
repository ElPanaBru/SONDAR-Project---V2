const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const moduloColorUrl = pathToFileURL(
  path.join(__dirname, '..', '..', 'Frontend', 'src', 'lib', 'colorPortada.js')
).href;

test('selecciona el color dominante e ignora blancos del fondo', async () => {
  const { seleccionarColorDominante } = await import(moduloColorUrl);
  const pixeles = [];

  for (let indice = 0; indice < 80; indice += 1) {
    pixeles.push(220, 42, 34, 255);
  }
  for (let indice = 0; indice < 20; indice += 1) {
    pixeles.push(255, 255, 255, 255);
  }

  assert.equal(seleccionarColorDominante(Uint8ClampedArray.from(pixeles)), '#dc2a22');
});

test('normaliza y mezcla colores de portada de forma segura', async () => {
  const {
    COLOR_PORTADA_PREDETERMINADO,
    mezclarColores,
    normalizarColorPortada,
  } = await import(moduloColorUrl);

  assert.equal(normalizarColorPortada('#A1B2C3'), '#a1b2c3');
  assert.equal(normalizarColorPortada('javascript:alert(1)'), COLOR_PORTADA_PREDETERMINADO);
  assert.equal(mezclarColores('#ff0000', '#000000', 0.5), '#800000');
});

test('la lectura remota distingue fallback, error y cancelacion', async () => {
  const {
    COLOR_PORTADA_PREDETERMINADO,
    extraerColorDominanteDesdeUrl,
  } = await import(moduloColorUrl);
  const fetchOriginal = global.fetch;

  try {
    global.fetch = async () => {
      throw new TypeError('Portada sin CORS');
    };
    assert.equal(
      await extraerColorDominanteDesdeUrl('https://portadas.test/sin-cors.jpg'),
      COLOR_PORTADA_PREDETERMINADO
    );
    await assert.rejects(
      extraerColorDominanteDesdeUrl('https://portadas.test/sin-cors.jpg', {
        usarRespaldoEnError: false,
      }),
      /Portada sin CORS/
    );

    global.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
      const cancelar = () => {
        const error = new Error('Cancelado');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal.aborted) cancelar();
      else signal.addEventListener('abort', cancelar, { once: true });
    });
    const controlador = new AbortController();
    const lectura = extraerColorDominanteDesdeUrl('https://portadas.test/lenta.jpg', {
      signal: controlador.signal,
      usarRespaldoEnError: false,
    });
    controlador.abort();
    await assert.rejects(lectura, { name: 'AbortError' });
  } finally {
    global.fetch = fetchOriginal;
  }
});
