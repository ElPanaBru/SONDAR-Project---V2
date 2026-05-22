require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const eventosRoutes = require('./routes/eventos');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
//Limite para imagenes

const app = express();
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
