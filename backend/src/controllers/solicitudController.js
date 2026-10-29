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

const obtener = async (req, res) => {
  try {
    const s = await db.Solicitud.findOne({ where: { id: req.params.id } });
    if (!s) {
      return res.status(404).json({ mensaje: 'Solicitud no encontrada' });
    }
    const p = s.get ? s.get({ plain: true }) : s;
    return res.status(200).json(p);
  } catch (error) {
    console.error('ERR_OBTENER:', error && error.stack ? error.stack.split('\n')[0] : error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
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
