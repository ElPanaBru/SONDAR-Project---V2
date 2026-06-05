const express = require('express');
const multer = require('multer');
const router = express.Router();
const eventoController = require('../Controllers/eventoController');
const authMiddleware = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.get('/', eventoController.listarEventos);
router.post('/crear', authMiddleware, upload.single('imagen'), eventoController.crearEvento);

module.exports = router;
