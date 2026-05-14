const express = require('express');
const router = express.Router(); //Permite que posts solicite a index

// Esto es lo que verás en la pantalla de Comunidad
const datosDePrueba = [
  { id: 1, usuario: "Sondar_Admin", texto: "¡La arquitectura está lista!" },
  { id: 2, usuario: "Sondar_Team", texto: "Probando Bootswatch y Leaflet." }
];

router.get('/muro', (req, res) => {   // Ruta para obtener los posts del muro Api/posts/muro, son acumulativas
  res.json(datosDePrueba);
});

module.exports = router;