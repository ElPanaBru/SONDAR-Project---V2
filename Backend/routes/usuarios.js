const express = require('express');
const router = express.Router();
const usuariosController = require('../Controllers/usuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/crear-cuenta', usuariosController.crearCuenta);
router.get('/me', authMiddleware, usuariosController.verificarUsuario);
router.post('/registrar', authMiddleware, usuariosController.registrarUsuario);
router.post('/convertir-a-musico', authMiddleware, usuariosController.convertirAMusico);
router.delete('/me', authMiddleware, usuariosController.eliminarCuentaActual);

module.exports = router;
