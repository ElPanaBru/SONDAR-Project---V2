const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../shared')];
const backendUrl = new URL(process.env.SONDAR_LOCAL_API_URL || 'http://127.0.0.1:3000');
const supabaseUrl = new URL(process.env.SONDAR_LOCAL_SUPABASE_URL || 'http://127.0.0.1:55321');
const originalEnhanceMiddleware = config.server?.enhanceMiddleware;

function proxyToBackend(req, res, target = backendUrl, requestPath = req.url) {
  const headers = { ...req.headers, host: target.host };
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || 80,
    method: req.method,
    path: requestPath,
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
      if (req.url?.startsWith('/supabase/')) {
        proxyToBackend(req, res, supabaseUrl, req.url.slice('/supabase'.length));
        return;
      }
      if (req.url?.startsWith('/api/')) {
        proxyToBackend(req, res);
        return;
      }

      enhanced(req, res, next);
    };
  },
};

module.exports = config;
