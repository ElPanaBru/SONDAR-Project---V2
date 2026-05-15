const express = require('express');
const router = express.Router();
const usuariosController = require('../Controllers/Usuario_Controller');

router.get('/', usuariosController.listarUsuarios);
router.get('/verificar/:uid', usuariosController.verificarUsuario);
router.post('/registrar', usuariosController.registrarUsuario);
router.get('/:uid', usuariosController.obtenerCuenta);
router.get('/:uid/perfil', usuariosController.obtenerPerfil);
router.put('/:uid/perfil', usuariosController.actualizarPerfil);
router.get('/:uid/configuracion', usuariosController.obtenerConfiguracion);
router.put('/:uid/configuracion', usuariosController.actualizarConfiguracion);
router.get('/:uid/guardados', usuariosController.obtenerGuardados);
router.post('/:uid/guardados', usuariosController.guardarItem);
router.delete('/:uid/guardados/:itemType/:itemId', usuariosController.eliminarGuardado);
router.post('/:uid/interacciones', usuariosController.guardarInteraccion);
router.get('/:uid/publicaciones', usuariosController.obtenerPublicaciones);
router.post('/:uid/publicaciones', usuariosController.crearPublicacion);
router.post('/convertir-a-musico', usuariosController.convertirAMusico);

module.exports = router;
