require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');
const postsRoutes = require('./routes/posts');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de CORS adaptada a tus variables de entorno
app.use(cors({
  origin: process.env.FRONTEND_URL, // Lee directamente el http://localhost:3001 de tu .env
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Recomendado para mantener sesiones y tokens seguros
}));

app.use(express.json());

// Rutas Globales de la API
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/eventos', eventosRoutes);
app.use('/api/posts', postsRoutes);

app.listen(PORT, () => console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`));
