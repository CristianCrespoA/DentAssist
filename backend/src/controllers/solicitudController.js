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
    const solicitud = await db.Solicitud.findByPk(req.params.id, {
      include: [
        { model: db.Paciente, as: 'paciente' },
        { model: db.Servicio, as: 'servicio' },
        { model: db.Cita, as: 'cita' },
        {
          model: db.Conversacion,
          as: 'conversacion',
          include: [
            {
              model: db.Mensaje,
              as: 'mensajes',
              order: [['ocurridoEn', 'ASC']]
            }
          ]
        },
        {
          model: db.SolicitudHistorial,
          as: 'historial',
          include: [
            { model: db.Usuario, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] }
          ],
          order: [['createdAt', 'ASC']]
        }
      ]
    });

    if (!solicitud) {
      throw errorNegocio('Solicitud no encontrada', 404);
    }

    return res.status(200).json(solicitud);
  } catch (error) {
    return manejarError(res, error);
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
