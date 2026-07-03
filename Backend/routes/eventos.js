const express = require('express');
const multer = require('multer');
const router = express.Router();
const eventoController = require('../Controllers/eventoController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.get('/', eventoController.listarEventos);
router.post('/crear', authMiddleware, upload.single('imagen'), evitarCreacionDuplicada('crear-evento'), eventoController.crearEvento);
router.post('/:id/guardar', authMiddleware, eventoController.alternarGuardado);
router.post('/:id/denunciar', authMiddleware, eventoController.denunciarEvento);
router.delete('/:id', authMiddleware, eventoController.eliminarEvento);

module.exports = router;
