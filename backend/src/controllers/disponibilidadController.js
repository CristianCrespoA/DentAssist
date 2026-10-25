const disponibilidadService = require('../services/disponibilidadService');
const { manejarError } = require('../utils/errores');

const consultar = async (req, res) => {
  try {
    const { fecha, profesionalId, servicioId } = req.query;
    const disponibilidad = await disponibilidadService.obtenerDisponibilidad({
      fecha,
      profesionalId,
      servicioId
    });
    return res.status(200).json(disponibilidad);
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  consultar
};
