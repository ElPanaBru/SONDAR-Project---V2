const express = require('express');
const router = express.Router();
const usuariosController = require('../Controllers/Usuario_Controller');

router.get('/verificar/:uid', usuariosController.verificarUsuario);
router.post('/registrar', usuariosController.registrarUsuario);
router.post('/convertir-a-musico', usuariosController.convertirAMusico);

module.exports = router;