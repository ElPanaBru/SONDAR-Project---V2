const express = require('express');
const router = express.Router();
const eventoController = require('../Controllers/eventoController');

router.get('/', eventoController.listarEventos);
router.post('/crear', eventoController.crearEvento);

module.exports = router;