const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const soporteController = require('../Controllers/soporteController');

const router = express.Router();

router.post('/mensaje', authMiddleware, soporteController.enviarMensaje);

module.exports = router;
