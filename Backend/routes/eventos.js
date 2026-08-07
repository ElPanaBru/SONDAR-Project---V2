const express = require('express');
const router = express.Router();
const eventoController = require('../Controllers/eventoController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

router.get('/', eventoController.listarEventos);
router.post('/crear', authMiddleware, evitarCreacionDuplicada('crear-evento'), eventoController.crearEvento);
router.post('/:id/guardar', authMiddleware, eventoController.alternarGuardado);
router.post('/:id/denunciar', authMiddleware, eventoController.denunciarEvento);
router.delete('/:id', authMiddleware, eventoController.eliminarEvento);

module.exports = router;
