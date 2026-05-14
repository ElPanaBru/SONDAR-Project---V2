require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');

const app = express();
app.use(cors());
app.use(express.json());

// Montamos las rutas
app.use('/api/usuarios', usuariosRoutes);

app.listen(3000, () => console.log("Servidor en puerto 3000"));
