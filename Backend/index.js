const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');
const postsRoutes = require('./routes/posts');
const reelsRoutes = require('./routes/reels');
const comunidadesRoutes = require('./routes/comunidades');
const notificacionesRoutes = require('./routes/notificaciones');
const soporteRoutes = require('./routes/soporte');
const { asegurarEsquemaConfiguracion } = require('./services/settingsSchema');

const app = express();
const PORT = process.env.PORT || 3000;
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

// Configuración de CORS adaptada a tus variables de entorno
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin) || esOrigenDesarrolloLocal(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Recomendado para mantener sesiones y tokens seguros
}));

app.use(express.json({ limit: '8mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    port: PORT,
    frontendUrl: process.env.FRONTEND_URL || null,
    supabaseUrl: process.env.SUPABASE_URL || null,
    dbHost: process.env.DB_HOST || null,
    dbName: process.env.DB_NAME || null,
    dbUser: process.env.DB_USER || null,
    settingsSchema: 3
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

async function iniciarServidor() {
  try {
    await asegurarEsquemaConfiguracion();
    app.listen(PORT, () => console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`));
  } catch (error) {
    console.error('No se pudo preparar el esquema de configuracion:', error);
    process.exitCode = 1;
  }
}

iniciarServidor();
