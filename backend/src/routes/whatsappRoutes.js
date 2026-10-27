const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { esSimuladorHabilitado } = require('../config/whatsapp');

// El simulador nunca debe quedar expuesto en producción.
const simuladorHabilitado = (req, res, next) => {
  if (!esSimuladorHabilitado()) {
    return res.status(404).json({ mensaje: 'El simulador no está habilitado' });
  }

  return next();
};

// Webhook público: se autentica con el verify token y la firma de Meta.
router.get('/webhook', whatsappController.verificar);
router.post('/webhook', whatsappController.recibir);
router.post('/simular', simuladorHabilitado, whatsappController.simular);

module.exports = router;
