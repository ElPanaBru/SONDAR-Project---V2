const express = require('express');
const router = express.Router();
const perfilComunidadController = require('../Controllers/perfilComunidadController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

router.get('/:identificador', authMiddleware.opcional, perfilComunidadController.listarPublicaciones);
router.post(
  '/publicaciones',
  authMiddleware,
  evitarCreacionDuplicada('crear-publicacion-perfil'),
  perfilComunidadController.crearPublicacion
);
router.post(
  '/publicaciones/:publicacionId/respuestas',
  authMiddleware,
  evitarCreacionDuplicada('crear-respuesta-perfil'),
  perfilComunidadController.crearRespuesta
);
router.delete('/publicaciones/:publicacionId', authMiddleware, perfilComunidadController.eliminarPublicacion);
router.delete('/respuestas/:respuestaId', authMiddleware, perfilComunidadController.eliminarRespuesta);

module.exports = router;
