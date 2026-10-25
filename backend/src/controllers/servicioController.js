const servicioService = require('../services/servicioService');
const { manejarError } = require('../utils/errores');

const listar = async (req, res) => {
  try {
    const { buscar } = req.query;
    const servicios = await servicioService.listarServicios({ buscar });
    return res.status(200).json(servicios);
  } catch (error) {
    return manejarError(res, error);
  }
};

const obtener = async (req, res) => {
  try {
    const servicio = await servicioService.obtenerServicio(req.params.id);
    return res.status(200).json(servicio);
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  listar,
  obtener
};
