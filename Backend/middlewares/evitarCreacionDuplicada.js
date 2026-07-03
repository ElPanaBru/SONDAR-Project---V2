const crypto = require('crypto');

const operaciones = new Map();
const DURACION_CACHE_MS = 5000;

function ordenarValor(valor) {
  if (Array.isArray(valor)) return valor.map(ordenarValor);
  if (!valor || typeof valor !== 'object') return valor;

  return Object.keys(valor)
    .sort()
    .reduce((resultado, clave) => {
      resultado[clave] = ordenarValor(valor[clave]);
      return resultado;
    }, {});
}

function describirArchivos(req) {
  const archivos = [];
  if (req.file) archivos.push(req.file);
  if (Array.isArray(req.files)) archivos.push(...req.files);
  if (req.files && !Array.isArray(req.files)) {
    Object.values(req.files).forEach((grupo) => archivos.push(...grupo));
  }

  return archivos.map((archivo) => ({
    fieldname: archivo.fieldname,
    originalname: archivo.originalname,
    mimetype: archivo.mimetype,
    size: archivo.size,
  }));
}

function crearClave(req, ambito) {
  const claveExplicita = String(req.get('Idempotency-Key') || '').trim();
  const identidad = req.user?.id || req.ip || 'anonimo';
  const contenido = claveExplicita
    ? `${identidad}:${ambito}:${claveExplicita.slice(0, 160)}`
    : JSON.stringify({
      identidad,
      ambito,
      ruta: req.originalUrl,
      body: ordenarValor(req.body || {}),
      archivos: describirArchivos(req),
    });

  return crypto.createHash('sha256').update(contenido).digest('hex');
}

function limpiarExpiradas() {
  const ahora = Date.now();
  for (const [clave, operacion] of operaciones) {
    if (operacion.expira <= ahora) operaciones.delete(clave);
  }
}

function evitarCreacionDuplicada(ambito) {
  return async (req, res, next) => {
    limpiarExpiradas();
    const clave = crearClave(req, ambito);
    const existente = operaciones.get(clave);

    if (existente) {
      const respuesta = await existente.promesa;
      res.set('Idempotency-Replayed', 'true');
      return res.status(respuesta.status).json(respuesta.body);
    }

    let resolver;
    const promesa = new Promise((resolve) => {
      resolver = resolve;
    });
    const operacion = {
      promesa,
      expira: Date.now() + DURACION_CACHE_MS,
      resuelta: false,
    };
    operaciones.set(clave, operacion);

    const jsonOriginal = res.json.bind(res);
    res.json = (body) => {
      if (!operacion.resuelta) {
        operacion.resuelta = true;
        operacion.expira = Date.now() + DURACION_CACHE_MS;
        resolver({ status: res.statusCode, body });
      }
      return jsonOriginal(body);
    };

    res.once('close', () => {
      if (!operacion.resuelta) {
        operaciones.delete(clave);
        operacion.resuelta = true;
        resolver({ status: 503, body: { error: 'La operacion fue interrumpida.' } });
      }
    });

    return next();
  };
}

module.exports = evitarCreacionDuplicada;
