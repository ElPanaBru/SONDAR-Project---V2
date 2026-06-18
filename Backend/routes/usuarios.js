const express = require('express');
const router = express.Router();
const usuariosController = require('../Controllers/usuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/crear-cuenta', usuariosController.crearCuenta);
router.get('/me', authMiddleware, usuariosController.verificarUsuario);
router.get('/me/perfil', authMiddleware, usuariosController.obtenerPerfilActual);
router.put('/me/perfil', authMiddleware, usuariosController.actualizarPerfilActual);
router.get('/me/seguidos', authMiddleware, usuariosController.listarSeguidosActuales);
router.get('/', usuariosController.buscarUsuarios);
router.post('/registrar', authMiddleware, usuariosController.registrarUsuario);
router.post('/convertir-a-musico', authMiddleware, usuariosController.convertirAMusico);
router.delete('/me', authMiddleware, usuariosController.eliminarCuentaActual);
router.get('/:identificador/perfil', authMiddleware, usuariosController.obtenerPerfilPublico);
router.post('/:identificador/seguir', authMiddleware, usuariosController.alternarSeguimiento);

module.exports = router;
