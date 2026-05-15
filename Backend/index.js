require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usuariosRoutes = require('./routes/usuarios');
const postsRoutes = require('./routes/posts');
const eventosRoutes = require('./routes/eventos');
const initSchema = require('./db/schema');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Montamos las rutas
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/eventos', eventosRoutes);

initSchema()
  .then(() => {
    app.listen(3000, () => console.log("Servidor en puerto 3000"));
  })
  .catch((error) => {
    console.error("No se pudo inicializar la base de datos:", error);
    process.exit(1);
  });
