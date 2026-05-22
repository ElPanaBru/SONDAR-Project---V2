require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');
const app = express();
const path = require('path');
// Esto hace que la carpeta 'uploads' sea accesible desde el navegador
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// Montamos las rutas
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/eventos', eventosRoutes);
app.listen(3000, () => console.log("Servidor en puerto 3000"));
