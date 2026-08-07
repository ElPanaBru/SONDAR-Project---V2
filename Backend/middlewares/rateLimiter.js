const buckets = new Map();

function identidadRequest(req) {
  return req.user?.id || req.ip || req.socket?.remoteAddress || 'desconocido';
}

function limpiarBucketsVencidos(ahora) {
  if (buckets.size < 2000) return;
  for (const [clave, bucket] of buckets) {
    if (bucket.resetAt <= ahora) buckets.delete(clave);
  }
}

function crearRateLimiter({ nombre, ventanaMs, maximo }) {
  if (!nombre || !Number.isFinite(ventanaMs) || !Number.isFinite(maximo)) {
    throw new Error('Configuracion de rate limiter invalida.');
  }

  return (req, res, next) => {
    const ahora = Date.now();
    limpiarBucketsVencidos(ahora);
    const clave = `${nombre}:${identidadRequest(req)}`;
    let bucket = buckets.get(clave);

    if (!bucket || bucket.resetAt <= ahora) {
      bucket = { cantidad: 0, resetAt: ahora + ventanaMs };
      buckets.set(clave, bucket);
    }

    bucket.cantidad += 1;
    const restantes = Math.max(0, maximo - bucket.cantidad);
    const segundosRestantes = Math.max(1, Math.ceil((bucket.resetAt - ahora) / 1000));

    res.set('RateLimit-Limit', String(maximo));
    res.set('RateLimit-Remaining', String(restantes));
    res.set('RateLimit-Reset', String(segundosRestantes));

    if (bucket.cantidad > maximo) {
      res.set('Retry-After', String(segundosRestantes));
      return res.status(429).json({
        error: 'Demasiadas solicitudes. Proba de nuevo mas tarde.',
        code: 'RATE_LIMITED',
      });
    }

    return next();
  };
}

module.exports = { crearRateLimiter };
