const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const net = require('node:net');
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

function proxySupabaseWebSocket(req, socket, head) {
  const requestPath = req.url?.slice('/supabase'.length) || '/';
  const upstream = net.connect(Number(supabaseUrl.port || 80), supabaseUrl.hostname);

  upstream.once('connect', () => {
    const headers = [];
    for (let index = 0; index < req.rawHeaders.length; index += 2) {
      if (req.rawHeaders[index].toLowerCase() === 'host') continue;
      headers.push(`${req.rawHeaders[index]}: ${req.rawHeaders[index + 1]}`);
    }
    headers.push(`Host: ${supabaseUrl.host}`);
    upstream.write(`${req.method} ${requestPath} HTTP/${req.httpVersion}\r\n${headers.join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });

  upstream.on('error', () => {
    if (!socket.destroyed) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    }
  });
  socket.on('error', () => upstream.destroy());
  socket.on('close', () => upstream.destroy());
}

config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    if (server?.on && !server.__sondarSupabaseUpgradeProxy) {
      const onUpgrade = (req, socket, head) => {
        let pathname = '';
        try {
          pathname = new URL(req.url || '/', 'http://localhost').pathname;
        } catch {
          return;
        }
        if (pathname !== '/supabase/realtime/v1/websocket') return;
        proxySupabaseWebSocket(req, socket, head);
      };

      if (server.prependListener) server.prependListener('upgrade', onUpgrade);
      else server.on('upgrade', onUpgrade);
      server.__sondarSupabaseUpgradeProxy = true;
    }

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
