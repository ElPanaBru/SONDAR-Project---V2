const express = require('express');
const router = express.Router();
const comunidadController = require('../Controllers/comunidadController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.opcional, comunidadController.listarComunidades);
router.get('/publicaciones', authMiddleware.opcional, comunidadController.buscarPublicaciones);
router.post('/:comunidadId/unirse', authMiddleware, comunidadController.alternarMembresia);
router.get('/:comunidadId/publicaciones', authMiddleware.opcional, comunidadController.listarPublicaciones);
router.post('/:comunidadId/publicaciones', authMiddleware, comunidadController.crearPublicacion);
router.post('/publicaciones/:publicacionId/comentarios', authMiddleware, comunidadController.crearComentario);
router.post('/publicaciones/:publicacionId/like', authMiddleware, comunidadController.alternarLikePublicacion);
router.post('/publicaciones/:publicacionId/guardar', authMiddleware, comunidadController.alternarGuardadoPublicacion);
router.post('/comentarios/:comentarioId/like', authMiddleware, comunidadController.alternarLikeComentario);

module.exports = router;
