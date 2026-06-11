const express = require('express');
const router = express.Router(); //Permite que posts solicite a index

// Endpoint prototipo. Actualmente no hay persistencia/DB conectada.
// Mantener para compatibilidad mientras se implementa Comunidad/Posts.
router.get('/muro', (req, res) => {
  res.json([]);
});

module.exports = router;