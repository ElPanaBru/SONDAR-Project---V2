const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const mensajeController = require('../Controllers/mensajeController');

const router = express.Router();

router.use(authMiddleware);
router.get('/no-leidos', mensajeController.unreadCount);
router.get('/conversaciones', mensajeController.listConversations);
router.post('/conversaciones', mensajeController.createConversation);
router.get('/conversaciones/:conversationId/mensajes', mensajeController.listMessages);
router.post('/conversaciones/:conversationId/mensajes', mensajeController.sendMessage);
router.patch('/conversaciones/:conversationId/leer', mensajeController.markRead);
router.patch('/mensajes/:messageId', mensajeController.editMessage);
router.delete('/mensajes/:messageId', mensajeController.deleteMessage);

module.exports = router;
