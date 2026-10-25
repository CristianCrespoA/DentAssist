const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const citaRoutes = require('./citaRoutes');
const pacienteRoutes = require('./pacienteRoutes');
const profesionalRoutes = require('./profesionalRoutes');
const servicioRoutes = require('./servicioRoutes');

router.get('/', (req, res) => {
  res.json({ message: 'API routes' });
});

router.use('/auth', authRoutes);
router.use('/pacientes', pacienteRoutes);
router.use('/citas', citaRoutes);
router.use('/profesionales', profesionalRoutes);
router.use('/servicios', servicioRoutes);

module.exports = router;