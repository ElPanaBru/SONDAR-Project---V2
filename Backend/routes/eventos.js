const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const eventoController = require('../Controllers/eventoController');

router.get('/', eventoController.listarEventos);

// AGREGAR 'upload.single("imagen")' AQUÍ:
router.post('/crear', upload.single('imagen'), eventoController.crearEvento);

module.exports = router;