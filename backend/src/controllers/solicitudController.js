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
    const solicitud = await db.Solicitud.findByPk(req.params.id);
    if (!solicitud) {
      throw errorNegocio('Solicitud no encontrada', 404);
    }
    let plain;
    try {
      plain = solicitud.toJSON ? solicitud.toJSON() : solicitud.get ? solicitud.get({ plain: true }) : solicitud;
    } catch (e) {
      plain = solicitud.get ? solicitud.get({ plain: true }) : solicitud;
    }

    try {
      plain.paciente = await db.Paciente.findByPk(plain.pacienteId);
      if (plain.paciente && plain.paciente.toJSON) plain.paciente = plain.paciente.toJSON();
    } catch (e) { console.error('ERR PACIENTE', e.message); }

    try {
      plain.servicio = await db.Servicio.findByPk(plain.servicioId);
      if (plain.servicio && plain.servicio.toJSON) plain.servicio = plain.servicio.toJSON();
    } catch (e) { console.error('ERR SERVICIO', e.message); }

    try {
      if (plain.citaId) {
        plain.cita = await db.Cita.findByPk(plain.citaId);
        if (plain.cita && plain.cita.toJSON) plain.cita = plain.cita.toJSON();
      }
    } catch (e) { console.error('ERR CITA', e.message); }

    try {
      if (plain.conversacionId) {
        plain.conversacion = await db.Conversacion.findByPk(plain.conversacionId);
        if (plain.conversacion && plain.conversacion.toJSON) plain.conversacion = plain.conversacion.toJSON();
        if (plain.conversacion && db.Mensaje) {
          const mensajes = await db.Mensaje.findAll({
            where: { conversacionId: plain.conversacion.id },
            order: [['ocurridoEn', 'ASC'], ['createdAt', 'ASC']]
          });
          plain.conversacion.mensajes = mensajes.map(m => (m.toJSON ? m.toJSON() : m));
        }
      }
    } catch (e) { console.error('ERR CONV', e.message); }

    try {
      const historial = await db.SolicitudHistorial.findAll({
        where: { solicitudId: plain.id },
        order: [['createdAt', 'ASC']]
      });
      plain.historial = [];
      for (const h of historial) {
        const ph = h.toJSON ? h.toJSON() : h;
        try {
          if (ph.usuarioId) {
            const u = await db.Usuario.findByPk(ph.usuarioId, { attributes: ['id', 'nombre', 'apellido'] });
            if (u) ph.usuario = u.toJSON ? u.toJSON() : u;
          }
        } catch (e2) { console.error('ERR HIST USR', e2.message); }
        plain.historial.push(ph);
      }
    } catch (e) { console.error('ERR HIST', e.message); }

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
