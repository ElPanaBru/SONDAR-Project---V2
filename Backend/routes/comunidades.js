const express = require('express');
const router = express.Router();
const comunidadController = require('../Controllers/comunidadController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

router.get('/', authMiddleware.opcional, comunidadController.listarComunidades);
router.get('/:comunidadId/publicaciones', authMiddleware.opcional, comunidadController.listarPublicaciones);
router.post('/:comunidadId/membresia', authMiddleware, comunidadController.alternarMembresia);
router.put('/:comunidadId/notificaciones', authMiddleware, comunidadController.actualizarNotificaciones);
router.post('/:comunidadId/publicaciones', authMiddleware, evitarCreacionDuplicada('crear-publicacion-comunidad'), comunidadController.crearPublicacion);
router.post('/publicaciones/:publicacionId/comentarios', authMiddleware, evitarCreacionDuplicada('crear-comentario-comunidad'), comunidadController.crearComentario);
router.post('/publicaciones/:publicacionId/like', authMiddleware, comunidadController.alternarLikePublicacion);
router.post('/publicaciones/:publicacionId/guardar', authMiddleware, comunidadController.alternarGuardadoPublicacion);
router.post('/publicaciones/:publicacionId/denunciar', authMiddleware, comunidadController.denunciarPublicacion);
router.post('/comentarios/:comentarioId/like', authMiddleware, comunidadController.alternarLikeComentario);
router.post('/comentarios/:comentarioId/denunciar', authMiddleware, comunidadController.denunciarComentario);

module.exports = router;
