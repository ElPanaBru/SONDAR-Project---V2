const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');
const postsRoutes = require('./routes/posts');
const reelsRoutes = require('./routes/reels');
const comunidadesRoutes = require('./routes/comunidades');
const notificacionesRoutes = require('./routes/notificaciones');
const soporteRoutes = require('./routes/soporte');
const seguridadHttp = require('./middlewares/seguridadHttp');
const { crearRateLimiter } = require('./middlewares/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;
const esProduccion = process.env.NODE_ENV === 'production';
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === 'true') app.set('trust proxy', 1);
else if (/^\d+$/.test(trustProxy || '')) app.set('trust proxy', Number(trustProxy));
app.disable('x-powered-by');
const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
].filter(Boolean));

function esOrigenDesarrolloLocal(origin) {
  try {
    const url = new URL(origin);
    const hostLocal = url.hostname === 'localhost'
      || url.hostname === '127.0.0.1'
      || /^10\./.test(url.hostname)
      || /^192\.168\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
    return url.protocol === 'http:' && hostLocal && ['3001', '5173'].includes(url.port);
  } catch {
    return false;
  }
}

app.use(seguridadHttp);

// Configuración de CORS adaptada a tus variables de entorno
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || (!esProduccion && esOrigenDesarrolloLocal(origin))) {
      callback(null, true);
      return;
    }

    const error = new Error('Origen no permitido por CORS.');
    error.status = 403;
    error.code = 'CORS_ORIGIN_DENIED';
    callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Recomendado para mantener sesiones y tokens seguros
}));
app.use('/api', crearRateLimiter({ nombre: 'api', ventanaMs: 60 * 1000, maximo: 180 }));
app.use('/api/usuarios/crear-cuenta', crearRateLimiter({ nombre: 'crear-cuenta', ventanaMs: 60 * 60 * 1000, maximo: 5 }));
app.use('/api/soporte', crearRateLimiter({ nombre: 'soporte', ventanaMs: 15 * 60 * 1000, maximo: 5 }));
app.use('/api/reels/crear', crearRateLimiter({ nombre: 'crear-reel', ventanaMs: 60 * 60 * 1000, maximo: 10 }));
app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: process.env.APP_VERSION || 'dev',
  });
});

// Rutas Globales de la API
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/reels', reelsRoutes);
app.use('/api/comunidades', comunidadesRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/soporte', soporteRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Ruta de API no encontrada.',
    code: 'NOT_FOUND',
    requestId: req.requestId,
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const esMulter = error?.name === 'MulterError';
  const status = esMulter
    ? error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    : Number(error.status || error.statusCode) || 500;
  if (status >= 500) console.error(`[${req.requestId}] Error no controlado:`, error);
  return res.status(status).json({
    error: esMulter
      ? status === 413 ? 'El archivo supera el limite permitido.' : 'La carga de archivos no es valida.'
      : status >= 500 ? 'Error interno del servidor.' : error.message,
    code: esMulter ? 'UPLOAD_INVALID' : error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
    requestId: req.requestId,
  });
});

async function iniciarServidor() {
  try {
    app.listen(PORT, () => console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`));
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) iniciarServidor();

module.exports = { app, iniciarServidor };
