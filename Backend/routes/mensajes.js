const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const mensajeController = require('../Controllers/mensajeController');

const router = express.Router();

router.get('/', authMiddleware, mensajeController.listarConversaciones);
router.post('/', authMiddleware, mensajeController.crearConversacion);
router.get('/:id', authMiddleware, mensajeController.obtenerConversacion);
router.post('/:id', authMiddleware, mensajeController.enviarMensaje);

module.exports = router;
