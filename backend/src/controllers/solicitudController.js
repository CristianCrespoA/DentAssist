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
      plain = solicitud.get ? solicitud.get({ plain: true }) : solicitud;
    } catch (e) {
      plain = JSON.parse(JSON.stringify(solicitud));
    }

    try { plain.paciente = plain.pacienteId ? (await db.Paciente.findByPk(plain.pacienteId))?.get?.({ plain: true }) || null : null; } catch (e) { console.error('ERR PACIENTE', e.message); }
    try { plain.servicio = plain.servicioId ? (await db.Servicio.findByPk(plain.servicioId))?.get?.({ plain: true }) || null : null; } catch (e) { console.error('ERR SERVICIO', e.message); }
    try { plain.cita = plain.citaId ? (await db.Cita.findByPk(plain.citaId))?.get?.({ plain: true }) || null : null; } catch (e) { console.error('ERR CITA', e.message); }

    try {
      if (plain.conversacionId) {
        const conv = await db.Conversacion.findByPk(plain.conversacionId);
        plain.conversacion = conv ? (conv.get ? conv.get({ plain: true }) : conv) : null;
        if (plain.conversacion && db.Mensaje) {
          try {
            const mensajes = await db.Mensaje.findAll({
              where: { conversacionId: plain.conversacion.id },
              order: [['ocurridoEn', 'ASC'], ['createdAt', 'ASC']]
            });
            plain.conversacion.mensajes = mensajes.map(m => (m.get ? m.get({ plain: true }) : m));
          } catch (e2) { console.error('ERR MENSAJES', e2.message); plain.conversacion.mensajes = []; }
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
        const ph = h.get ? h.get({ plain: true }) : h;
        try {
          if (ph.usuarioId) {
            const u = await db.Usuario.findByPk(ph.usuarioId, { attributes: ['id', 'nombre', 'apellido'] });
            if (u) ph.usuario = u.get ? u.get({ plain: true }) : u;
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
