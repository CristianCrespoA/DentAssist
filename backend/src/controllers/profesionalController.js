const profesionalService = require('../services/profesionalService');
const { manejarError } = require('../utils/errores');

const listar = async (req, res) => {
  try {
    const { buscar, especialidad } = req.query;
    const profesionales = await profesionalService.listarProfesionales({ buscar, especialidad });
    return res.status(200).json(profesionales);
  } catch (error) {
    return manejarError(res, error);
  }
};

const obtener = async (req, res) => {
  try {
    const profesional = await profesionalService.obtenerProfesional(req.params.id);
    return res.status(200).json(profesional);
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  listar,
  obtener
};
