const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');

router.post('/login', authController.login);
router.post('/register', authMiddleware, roleMiddleware(['admin']), authController.register);
router.post('/usuarios', authMiddleware, roleMiddleware(['admin']), authController.register);
router.get('/usuarios', authMiddleware, roleMiddleware(['admin']), authController.listarUsuarios);
router.get('/usuarios/:id', authMiddleware, roleMiddleware(['admin']), authController.obtenerUsuario);
router.put('/usuarios/:id', authMiddleware, roleMiddleware(['admin']), authController.actualizarUsuario);
router.patch('/usuarios/:id/password', authMiddleware, roleMiddleware(['admin']), authController.cambiarContrasena);
router.patch('/usuarios/:id/contrasena', authMiddleware, roleMiddleware(['admin']), authController.cambiarContrasena);
router.delete('/usuarios/:id', authMiddleware, roleMiddleware(['admin']), authController.eliminarUsuario);
router.get('/perfil', authMiddleware, authController.perfil);

module.exports = router;
