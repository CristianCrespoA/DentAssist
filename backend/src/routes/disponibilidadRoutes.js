const express = require('express');
const router = express.Router();
const disponibilidadController = require('../controllers/disponibilidadController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../utils/roles');

router.use(authMiddleware, roleMiddleware(ROLES_PERSONAL));

router.get('/', disponibilidadController.consultar);

module.exports = router;
