'use strict';

const express = require('express');
const router = express.Router();
const { autenticar, autorizar } = require('../middlewares/auth');
const { responderDesdeDashboard } = require('../controllers/whatsappChatController');

router.post('/solicitudes/:solicitudId/responder', autenticar, autorizar(['admin', 'recepcionista']), responderDesdeDashboard);

module.exports = router;
