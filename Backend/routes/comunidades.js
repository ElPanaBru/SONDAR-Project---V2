const express = require('express');
const router = express.Router();
const comunidadController = require('../Controllers/comunidadController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', comunidadController.listarComunidades);
router.get('/:comunidadId/publicaciones', comunidadController.listarPublicaciones);
router.post('/:comunidadId/publicaciones', authMiddleware, comunidadController.crearPublicacion);
router.post('/publicaciones/:publicacionId/comentarios', authMiddleware, comunidadController.crearComentario);
router.post('/publicaciones/:publicacionId/like', authMiddleware, comunidadController.alternarLikePublicacion);
router.post('/publicaciones/:publicacionId/guardar', authMiddleware, comunidadController.alternarGuardadoPublicacion);
router.post('/publicaciones/:publicacionId/denunciar', authMiddleware, comunidadController.denunciarPublicacion);
router.post('/comentarios/:comentarioId/like', authMiddleware, comunidadController.alternarLikeComentario);
router.delete('/comentarios/:comentarioId', authMiddleware, comunidadController.eliminarComentario);

module.exports = router;
