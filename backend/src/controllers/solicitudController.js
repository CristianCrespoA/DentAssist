const solicitudService = require('../services/solicitudService');
const { manejarError, errorNegocio } = require('../utils/errores');
const db = require('../models');

const listar = async (req, res) => {
  try {
    const { estado, tipo, pacienteId, fecha, pagina, limite } = req.query;
    const resultado = await solicitudService.listarSolicitudes({
      estado,
      tipo,
      pacienteId,
      fecha,
      pagina,
      limite
    });
    return res.status(200).json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
};

const obtener = (req, res) => {
  res.status(200).json({ id: req.params.id });
};

const cambiarEstado = async (req, res) => {
  try {
    const solicitud = await solicitudService.cambiarEstadoSolicitud(
      req.params.id,
      req.body,
      req.usuario
    );
    return res.status(200).json(solicitud);
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  listar,
  obtener,
  cambiarEstado
};
