const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');

router.get('/', (req, res) => {
  res.json({ message: 'API routes' });
});

router.use('/auth', authRoutes);

module.exports = router;