'use strict';

const { randomUUID } = require('crypto');
const db = require('../models');
const { VENTANA_SERVICIO_MS } = require('../config/whatsapp');
const { registrar, registrarError } = require('../utils/registroWhatsapp');
const { MOTIVO_VENTANA_CERRADA } = require('../utils/whatsapp');
const whatsappApi = require('./whatsappApi');

const motivoSeguro = (error) => {
  if (error?.codigo === 'sin_configuracion') return 'WhatsApp no está configurado';

  if (error?.status) return `La API de WhatsApp respondió ${error.status}`;

  return 'No se pudo enviar el mensaje por WhatsApp';
};

/**
 * Meta permite responder libremente durante las 24 h siguientes al último
 * mensaje del paciente. Con la ventana cerrada solo se puede usar una plantilla.
 */
const ventanaAbierta = async (conversacion) => {
  const ultimoEntrante = await db.Mensaje.findOne({
    where: { conversacionId: conversacion.id, direccion: 'entrante' },
    order: [['ocurridoEn', 'DESC'], ['id', 'DESC']]
  });

  if (!ultimoEntrante?.ocurridoEn) return false;

  const fecha = new Date(ultimoEntrante.ocurridoEn).getTime();

  if (Number.isNaN(fecha)) return false;

  return Date.now() - fecha <= VENTANA_SERVICIO_MS;
};

/**
 * Envía un mensaje saliente y lo persiste con su estado. Si la ventana de 24 h
 * está cerrada no llama a Meta: registra el mensaje como fallido y que requiere
 * plantilla. En modo simulado no se hace la petición HTTP.
 *
 * Es reutilizado por el pipeline de WhatsApp y por las notificaciones que se
 * disparan desde la web al resolver una solicitud.
 */
const enviarYGuardar = async ({
  conversacion,
  contenido,
  textoPlano,
  tipo = 'texto',
  simulado = false,
  payload = null
}) => {
  const ahora = new Date();
  const abierta = await ventanaAbierta(conversacion);

  if (!abierta) {
    const mensaje = await db.Mensaje.create({
      conversacionId: conversacion.id,
      direccion: 'saliente',
      tipo,
      contenido: textoPlano ?? null,
      payload,
      estado: 'fallido',
      ocurridoEn: ahora,
      estadoActualizadoEn: ahora,
      motivoFallo: MOTIVO_VENTANA_CERRADA,
      requierePlantilla: true
    });

    registrar('envio_requiere_plantilla', {
      conversacionId: conversacion.id,
      mensajeId: mensaje.id
    });

    return mensaje;
  }

  let resultado;

  try {
    resultado = simulado
      ? { waMessageId: `simulado-saliente-${randomUUID()}` }
      : await whatsappApi.enviarMensaje(conversacion.telefono, contenido);
  } catch (error) {
    const mensaje = await db.Mensaje.create({
      conversacionId: conversacion.id,
      direccion: 'saliente',
      tipo,
      contenido: textoPlano ?? null,
      payload,
      estado: 'fallido',
      ocurridoEn: ahora,
      estadoActualizadoEn: ahora,
      motivoFallo: motivoSeguro(error)
    });

    registrarError('envio_fallido', error, {
      conversacionId: conversacion.id,
      mensajeId: mensaje.id
    });

    return mensaje;
  }

  const mensaje = await db.Mensaje.create({
    conversacionId: conversacion.id,
    waMessageId: resultado?.waMessageId ?? null,
    direccion: 'saliente',
    tipo,
    contenido: textoPlano ?? null,
    payload,
    estado: 'enviado',
    ocurridoEn: ahora,
    estadoActualizadoEn: ahora
  });

  await conversacion.update({ ultimaActividad: ahora });

  return mensaje;
};

module.exports = {
  enviarYGuardar,
  motivoSeguro,
  ventanaAbierta
};
