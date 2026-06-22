const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const notificacionController = require('../Controllers/notificacionController');

const router = express.Router();

router.get('/', authMiddleware, notificacionController.listar);
router.get('/no-leidas', authMiddleware, notificacionController.contarNoLeidas);
router.post('/leer-todas', authMiddleware, notificacionController.marcarTodasLeidas);
router.post('/:id/leer', authMiddleware, notificacionController.marcarLeida);
router.delete('/leidas', authMiddleware, notificacionController.eliminarLeidas);

module.exports = router;
