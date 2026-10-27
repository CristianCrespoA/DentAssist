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

router.get('/', (req, res) => {
  res.json({ message: 'API routes' });
});

router.use('/auth', authRoutes);
router.use('/pacientes', pacienteRoutes);
router.use('/citas', citaRoutes);
router.use('/disponibilidad', disponibilidadRoutes);
router.use('/profesionales', profesionalRoutes);
router.use('/servicios', servicioRoutes);
router.use('/solicitudes', solicitudRoutes);
router.use('/whatsapp', whatsappRoutes);

module.exports = router;