const crypto = require('crypto');

function seguridadHttp(req, res, next) {
  const requestId = String(req.get('X-Request-Id') || '').trim().slice(0, 100)
    || crypto.randomUUID();
  req.requestId = requestId;
  res.set({
    'X-Request-Id': requestId,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  next();
}

module.exports = seguridadHttp;
