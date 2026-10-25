const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');

router.post('/login', authController.login);
router.post('/register', authMiddleware, roleMiddleware(['admin']), authController.register);
router.get('/perfil', authMiddleware, authController.perfil);

module.exports = router;
