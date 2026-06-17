const express = require('express');
const multer = require('multer');
const router = express.Router();
const reelController = require('../Controllers/reelController');
const authMiddleware = require('../middlewares/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

router.get('/', reelController.listarReels);
router.get('/:id/comentarios', reelController.listarComentarios);
router.post(
  '/crear',
  authMiddleware,
  upload.fields([
    { name: 'portada', maxCount: 1 },
    { name: 'audio', maxCount: 1 }
  ]),
  reelController.crearReel
);
router.post('/:id/comentarios', authMiddleware, reelController.crearComentario);
router.post('/:id/like', authMiddleware, reelController.alternarLike);
router.post('/:id/guardar', authMiddleware, reelController.alternarGuardado);
router.delete('/:id', authMiddleware, reelController.eliminarReel);

module.exports = router;
