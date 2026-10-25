const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const citaRoutes = require('./citaRoutes');

router.get('/', (req, res) => {
  res.json({ message: 'API routes' });
});

router.use('/auth', authRoutes);
router.use('/citas', citaRoutes);

module.exports = router;