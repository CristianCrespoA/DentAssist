const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../utils/roles');

router.use(authMiddleware, roleMiddleware(ROLES_PERSONAL));

router.post('/', citaController.crear);
router.get('/', citaController.listar);
router.put('/:id', citaController.actualizar);
router.delete('/:id', citaController.eliminar);

module.exports = router;
