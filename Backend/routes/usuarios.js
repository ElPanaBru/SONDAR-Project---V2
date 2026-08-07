const express = require('express');
const multer = require('multer');
const router = express.Router();
const usuariosController = require('../Controllers/usuarioController');
const authMiddleware = require('../middlewares/authMiddleware');

const IMAGENES_PERMITIDAS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (IMAGENES_PERMITIDAS.has(file.mimetype)) return callback(null, true);
    const error = new Error('Formato de imagen no permitido.');
    error.code = 'ARCHIVO_INVALIDO';
    error.status = 400;
    return callback(error);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 12,
    parts: 13,
  }
});

router.post('/crear-cuenta', usuariosController.crearCuenta);
router.get('/me', authMiddleware, usuariosController.verificarUsuario);
router.get('/me/configuracion', authMiddleware, usuariosController.obtenerConfiguracionActual);
router.put('/me/configuracion', authMiddleware, usuariosController.actualizarConfiguracionActual);
router.get('/me/exportar', authMiddleware, usuariosController.exportarDatosActuales);
router.get('/me/perfil', authMiddleware, usuariosController.obtenerPerfilActual);
router.put('/me/perfil', authMiddleware, upload.single('avatar'), usuariosController.actualizarPerfilActual);
router.put('/me/onboarding', authMiddleware, upload.single('avatar'), usuariosController.completarOnboarding);
router.get('/me/seguidos', authMiddleware, usuariosController.listarSeguidosActuales);
router.get('/me/bloqueados', authMiddleware, usuariosController.listarBloqueadosActuales);
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
