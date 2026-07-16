const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);
const backendUrl = new URL(process.env.SONDAR_LOCAL_API_URL || 'http://127.0.0.1:3000');
const originalEnhanceMiddleware = config.server?.enhanceMiddleware;

function proxyToBackend(req, res) {
  const headers = { ...req.headers, host: backendUrl.host };
  const options = {
    protocol: backendUrl.protocol,
    hostname: backendUrl.hostname,
    port: backendUrl.port || 80,
    method: req.method,
    path: req.url,
    headers,
  };

  const proxyReq = http.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', error => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'No se pudo conectar con el backend local.',
      detail: error.message,
    }));
  });

  req.pipe(proxyReq);
}

config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const enhanced = originalEnhanceMiddleware
      ? originalEnhanceMiddleware(middleware, server)
      : middleware;

    return (req, res, next) => {
      if (req.url?.startsWith('/api/')) {
        proxyToBackend(req, res);
        return;
      }

      enhanced(req, res, next);
    };
  },
};

module.exports = config;
