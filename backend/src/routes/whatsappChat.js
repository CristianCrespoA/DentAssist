'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { responderDesdeDashboard } = require('../controllers/whatsappChatController');

router.post('/solicitudes/:solicitudId/responder', authMiddleware, roleMiddleware(['admin', 'recepcionista']), responderDesdeDashboard);

module.exports = router;
