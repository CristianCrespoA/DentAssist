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
              as: 'mensajes'
            }
          ]
        },
        {
          model: db.SolicitudHistorial,
          as: 'historial',
          include: [
            { model: db.Usuario, as: 'usuario', attributes: ['id', 'nombre', 'apellido'] }
          ]
        }
      ]
    });

    if (!solicitud) {
      throw errorNegocio('Solicitud no encontrada', 404);
    }

    const plain = solicitud.toJSON ? solicitud.toJSON() : solicitud;
    if (plain.conversacion && Array.isArray(plain.conversacion.mensajes)) {
      plain.conversacion.mensajes.sort((a, b) => {
        const ta = new Date(a.ocurridoEn || a.createdAt || 0).getTime();
        const tb = new Date(b.ocurridoEn || b.createdAt || 0).getTime();
        return ta - tb;
      });
    }
    if (Array.isArray(plain.historial)) {
      plain.historial.sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return ta - tb;
      });
    }

    return res.status(200).json(plain);
  } catch (error) {
    console.error('ERROR OBTENER SOLICITUD:', error);
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
