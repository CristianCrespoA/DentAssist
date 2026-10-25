const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../utils/roles');

router.use(authMiddleware, roleMiddleware(ROLES_PERSONAL));

router.post('/', pacienteController.crear);
router.get('/', pacienteController.listar);
router.get('/:id', pacienteController.obtener);
router.put('/:id', pacienteController.actualizar);
router.delete('/:id', pacienteController.eliminar);

module.exports = router;
