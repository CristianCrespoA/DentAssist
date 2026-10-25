const express = require('express');
const router = express.Router();
const servicioController = require('../controllers/servicioController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../utils/roles');

router.use(authMiddleware, roleMiddleware(ROLES_PERSONAL));

router.get('/', servicioController.listar);
router.get('/:id', servicioController.obtener);

module.exports = router;
