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
const recibirArchivosReel = upload.fields([
  { name: 'portada', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]);

function procesarArchivosReel(req, res, next) {
  recibirArchivosReel(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'El archivo no puede superar los 20MB.' });
    }

    const mensaje = error instanceof multer.MulterError
      ? 'La carga contiene demasiados archivos o campos no permitidos.'
      : error.message || 'No se pudieron procesar los archivos del reel.';
    return res.status(400).json({ error: mensaje });
  });
}

router.get('/', reelController.listarReels);
router.get('/:id', reelController.obtenerReel);
router.post('/:id/visita', authMiddleware, reelController.registrarVisita);
router.get('/:id/comentarios', reelController.listarComentarios);
router.post('/comentarios/:comentarioId/like', authMiddleware, reelController.alternarLikeComentario);
router.delete('/comentarios/:comentarioId', authMiddleware, reelController.eliminarComentario);
router.post(
  '/crear',
  authMiddleware,
  procesarArchivosReel,
  evitarCreacionDuplicada('crear-reel'),
  reelController.crearReel
);
router.post('/:id/comentarios', authMiddleware, evitarCreacionDuplicada('crear-comentario-reel'), reelController.crearComentario);
router.post('/:id/compartir', authMiddleware, reelController.registrarCompartido);
router.post('/:id/denunciar', authMiddleware, reelController.denunciarReel);
router.post('/:id/like', authMiddleware, reelController.alternarLike);
router.delete('/:id', authMiddleware, reelController.eliminarReel);

module.exports = router;
