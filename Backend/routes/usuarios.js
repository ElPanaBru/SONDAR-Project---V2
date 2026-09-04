const express = require('express');
const multer = require('multer');
const router = express.Router();
const usuariosController = require('../Controllers/usuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/crear-cuenta', usuariosController.crearCuenta);
router.get('/me', authMiddleware, usuariosController.verificarUsuario);
router.get('/me/configuracion', authMiddleware, usuariosController.obtenerConfiguracionActual);
router.put('/me/configuracion', authMiddleware, usuariosController.actualizarConfiguracionActual);
router.get('/me/exportar', authMiddleware, usuariosController.exportarDatosActuales);
router.get('/me/perfil', authMiddleware, usuariosController.obtenerPerfilActual);
router.put('/me/perfil', authMiddleware, upload.single('avatar'), usuariosController.actualizarPerfilActual);
router.put('/me/onboarding', authMiddleware, upload.single('avatar'), usuariosController.completarOnboarding);
router.post('/me/comunidad', authMiddleware, usuariosController.crearPublicacionComunidadPerfil);
router.get('/me/seguidos', authMiddleware, usuariosController.listarSeguidosActuales);
router.get('/me/bloqueados', authMiddleware, usuariosController.listarBloqueadosActuales);
router.post('/comunidad/:id/comentarios', authMiddleware, usuariosController.comentarPublicacionComunidadPerfil);
router.post('/comunidad/:id/denunciar', authMiddleware, usuariosController.denunciarPublicacionComunidadPerfil);
router.delete('/comunidad/:id', authMiddleware, usuariosController.eliminarPublicacionComunidadPerfil);
router.get('/', usuariosController.buscarUsuarios);
router.post('/registrar', authMiddleware, usuariosController.registrarUsuario);
router.post('/convertir-a-musico', authMiddleware, usuariosController.convertirAMusico);
router.delete('/me', authMiddleware, usuariosController.eliminarCuentaActual);
router.get('/:identificador/perfil', authMiddleware.opcional, usuariosController.obtenerPerfilPublico);
router.post('/:identificador/seguir', authMiddleware, usuariosController.alternarSeguimiento);
router.post('/:identificador/bloquear', authMiddleware, usuariosController.bloquearUsuario);
router.delete('/:identificador/bloquear', authMiddleware, usuariosController.desbloquearUsuario);
router.post('/:identificador/denunciar', authMiddleware, usuariosController.denunciarPerfil);
router.post('/:identificador/silenciar-notificaciones', authMiddleware, usuariosController.alternarSilencioNotificaciones);

module.exports = router;
