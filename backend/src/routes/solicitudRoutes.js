const express = require('express');
const router = express.Router();
const solicitudController = require('../controllers/solicitudController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../utils/roles');

router.use(authMiddleware, roleMiddleware(ROLES_PERSONAL));
router.get('/', solicitudController.listar);
router.get('/:id', solicitudController.obtener);
router.put('/:id/estado', solicitudController.cambiarEstado);

module.exports = router;
