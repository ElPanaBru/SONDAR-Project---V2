const express = require('express');
const multer = require('multer');
const router = express.Router();
const reelController = require('../Controllers/reelController');
const authMiddleware = require('../middlewares/authMiddleware');
const evitarCreacionDuplicada = require('../middlewares/evitarCreacionDuplicada');

const IMAGENES_PERMITIDAS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AUDIOS_PERMITIDOS = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4']);

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    const permitido = file.fieldname === 'portada'
      ? IMAGENES_PERMITIDAS.has(file.mimetype)
      : file.fieldname === 'audio' && AUDIOS_PERMITIDOS.has(file.mimetype);
    if (permitido) return callback(null, true);
    const error = new Error('Formato de archivo no permitido.');
    error.code = 'ARCHIVO_INVALIDO';
    error.status = 400;
    return callback(error);
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 2,
    fields: 8,
    parts: 10,
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
