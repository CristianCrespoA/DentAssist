const express = require('express');
const router = express.Router();
const profesionalController = require('../controllers/profesionalController');
const { authMiddleware, roleMiddleware } = require('../middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../utils/roles');

router.use(authMiddleware, roleMiddleware(ROLES_PERSONAL));

router.get('/', profesionalController.listar);
router.get('/:id', profesionalController.obtener);

module.exports = router;
