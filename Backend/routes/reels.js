const express = require('express');
const multer = require('multer');
const router = express.Router();
const reelController = require('../Controllers/reelController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

router.get('/', reelController.listarReels);
router.post('/:id/visita', authMiddleware, reelController.registrarVisita);
router.get('/:id/comentarios', reelController.listarComentarios);
router.post('/comentarios/:comentarioId/like', authMiddleware, reelController.alternarLikeComentario);
router.delete('/comentarios/:comentarioId', authMiddleware, reelController.eliminarComentario);
router.post(
  '/crear',
  authMiddleware,
  upload.fields([
    { name: 'portada', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
  ]),
  evitarCreacionDuplicada('crear-reel'),
  reelController.crearReel
);
router.post('/:id/comentarios', authMiddleware, evitarCreacionDuplicada('crear-comentario-reel'), reelController.crearComentario);
router.post('/:id/compartir', authMiddleware, reelController.registrarCompartido);
router.post('/:id/denunciar', authMiddleware, reelController.denunciarReel);
router.post('/:id/like', authMiddleware, reelController.alternarLike);
router.post('/:id/guardar', authMiddleware, reelController.alternarGuardado);
router.delete('/:id', authMiddleware, reelController.eliminarReel);

module.exports = router;
