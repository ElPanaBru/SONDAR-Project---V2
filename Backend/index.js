require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');
const postsRoutes = require('./routes/posts');
const reelsRoutes = require('./routes/reels');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean));

// Configuración de CORS adaptada a tus variables de entorno
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
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
    dbUser: process.env.DB_USER || null
  });
});

// Rutas Globales de la API
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/reels', reelsRoutes);

app.listen(PORT, () => console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`));
