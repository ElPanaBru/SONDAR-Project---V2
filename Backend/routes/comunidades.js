const express = require('express');
const router = express.Router();
const comunidadController = require('../Controllers/comunidadController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

router.get('/', comunidadController.listarComunidades);
router.get('/:comunidadId/publicaciones', comunidadController.listarPublicaciones);
router.post('/:comunidadId/membresia', authMiddleware, comunidadController.alternarMembresia);
router.put('/:comunidadId/membresia', authMiddleware, comunidadController.establecerMembresia);
router.delete('/:comunidadId/membresia', authMiddleware, comunidadController.establecerMembresia);
router.post('/:comunidadId/publicaciones', authMiddleware, evitarCreacionDuplicada('crear-publicacion-comunidad'), comunidadController.crearPublicacion);
router.get('/publicaciones/:publicacionId/comentarios', comunidadController.listarComentarios);
router.post('/publicaciones/:publicacionId/comentarios', authMiddleware, evitarCreacionDuplicada('crear-comentario-comunidad'), comunidadController.crearComentario);
router.post('/publicaciones/:publicacionId/like', authMiddleware, comunidadController.alternarLikePublicacion);
router.post('/publicaciones/:publicacionId/guardar', authMiddleware, comunidadController.alternarGuardadoPublicacion);
router.post('/comentarios/:comentarioId/like', authMiddleware, comunidadController.alternarLikeComentario);

module.exports = router;
