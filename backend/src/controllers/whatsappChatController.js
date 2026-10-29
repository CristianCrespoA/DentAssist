'use strict';

const db = require('../models');
const { errorNegocio } = require('../utils/errores');
const { enviarYGuardar } = require('../services/whatsappSalientes');
const { registrar } = require('../utils/registroWhatsapp');

const responderDesdeDashboard = async (req, res, next) => {
  try {
    const { solicitudId } = req.params;
    const { mensaje } = req.body;

    if (!mensaje || !String(mensaje).trim()) {
      throw errorNegocio('El mensaje no puede estar vacío', 400);
    }

    const solicitud = await db.Solicitud.findByPk(solicitudId, {
      include: [
        { model: db.Conversacion, as: 'conversacion' }
      ]
    });

    if (!solicitud) throw errorNegocio('Solicitud no encontrada', 404);
    if (!solicitud.conversacion) throw errorNegocio('Esta solicitud no tiene conversación de WhatsApp asociada', 400);
    if (solicitud.estado === 'resuelta') throw errorNegocio('La solicitud ya está resuelta', 400);

    const contenido = String(mensaje).trim();

    await enviarYGuardar({
      conversacion: solicitud.conversacion,
      contenido,
      textoPlano: contenido,
      tipo: 'texto'
    });

    if (solicitud.estado === 'pendiente') {
      await solicitud.update({ estado: 'en_atencion' });
      await db.SolicitudHistorial.create({
        solicitudId: solicitud.id,
        estadoAnterior: 'pendiente',
        estadoNuevo: 'en_atencion',
        usuarioId: req.usuario.id,
        comentario: 'Atendiendo desde chat de WhatsApp (dashboard)'
      });
    }

    registrar('chat_dashboard_respuesta', {
      solicitudId: solicitud.id,
      conversacionId: solicitud.conversacion.id,
      usuarioId: req.usuario.id
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { responderDesdeDashboard };
