const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const citaRoutes = require('./citaRoutes');
const disponibilidadRoutes = require('./disponibilidadRoutes');
const pacienteRoutes = require('./pacienteRoutes');
const profesionalRoutes = require('./profesionalRoutes');
const servicioRoutes = require('./servicioRoutes');
const solicitudRoutes = require('./solicitudRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const whatsappChatRoutes = require('./whatsappChat');
const authController = require('./controllers/authController');
const { authMiddleware, roleMiddleware } = require('./middlewares/authMiddleware');

router.get('/', (req, res) => {
  res.json({ message: 'API routes' });
});

router.use('/auth', authRoutes);
router.get('/usuarios', authMiddleware, roleMiddleware(['admin']), authController.listarUsuarios);
router.post('/usuarios', authMiddleware, roleMiddleware(['admin']), authController.register);
router.use('/usuarios', authRoutes);
router.use('/pacientes', pacienteRoutes);
router.use('/citas', citaRoutes);
router.use('/disponibilidad', disponibilidadRoutes);
router.use('/profesionales', profesionalRoutes);
router.use('/servicios', servicioRoutes);
router.use('/solicitudes', solicitudRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/whatsapp-chat', whatsappChatRoutes);

module.exports = router;
