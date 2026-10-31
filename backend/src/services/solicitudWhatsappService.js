'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const { esFechaValida, fechaHoyBogota } = require('../utils/tiempo');
const { formatearFecha } = require('../utils/whatsappInteractivo');

const MAX_CITAS = 5;
const VENTANA_AGRUPACION_MS = 10 * 60 * 1000;
const ESTADOS_CITA_GESTIONABLE = ['programada', 'confirmada'];
const ESTADOS_SOLICITUD_ABIERTA = ['pendiente', 'en_atencion'];
const TIPOS_ESCALAMIENTO = ['consulta', 'otra'];
const MENSAJE_ESCALAMIENTO_POR_DEFECTO = 'El paciente pidió hablar con una persona.';

const atributosServicio = ['id', 'nombre', 'duracionMinutos'];

const horaTexto = (hora) => (typeof hora === 'string' ? hora.slice(0, 5) : '');

const filtroCitaGestionable = () => ({
  estado: { [Op.in]: ESTADOS_CITA_GESTIONABLE },
  fecha: { [Op.gte]: fechaHoyBogota() }
});

const esCitaGestionable = (cita) => {
  if (!cita) return false;

  return (
    ESTADOS_CITA_GESTIONABLE.includes(cita.estado) &&
    String(cita.fecha ?? '').slice(0, 10) >= fechaHoyBogota()
  );
};

/**
 * Citas futuras que el paciente puede cancelar o reprogramar. Se muestran como
 * máximo cinco para respetar el tamaño de las listas de WhatsApp.
 */
const listarCitasFuturas = async (pacienteId, { limite = MAX_CITAS } = {}) => {
  if (!pacienteId) return [];

  return db.Cita.findAll({
    where: {
      pacienteId,
      ...filtroCitaGestionable()
    },
    include: [
      {
        model: db.Servicio,
        as: 'servicio',
        attributes: atributosServicio
      }
    ],
    order: [['fecha', 'ASC'], ['hora', 'ASC']],
    limit: limite
  });
};

const buscarCitaDelPaciente = async (
  pacienteId,
  citaId,
  { transaction = null, lock = null } = {}
) => {
  if (!pacienteId || !citaId) return null;

  return db.Cita.findOne({
    where: { id: citaId, pacienteId },
    include: [
      {
        model: db.Servicio,
        as: 'servicio',
        attributes: atributosServicio
      }
    ],
    ...(transaction ? { transaction } : {}),
    ...(lock ? { lock } : {})
  });
};

const obtenerCitaFutura = async (pacienteId, citaId) => {
  const cita = await buscarCitaDelPaciente(pacienteId, citaId);

  return esCitaGestionable(cita) ? cita : null;
};

/**
 * Una cita solo admite una gestión abierta a la vez. Así la insistencia del
 * paciente no genera solicitudes duplicadas de cancelación o reprogramación.
 */
const buscarSolicitudAbierta = async (citaId, { transaction = null, lock = null } = {}) => {
  if (!citaId) return null;

  return db.Solicitud.findOne({
    where: {
      citaId,
      estado: { [Op.in]: ESTADOS_SOLICITUD_ABIERTA }
    },
    order: [['id', 'DESC']],
    ...(transaction ? { transaction } : {}),
    ...(lock ? { lock } : {})
  });
};

const validarPropuesta = ({ tipo, fechaPropuesta, horaPropuesta }) => {
  if (tipo !== 'reprogramacion') return;

  if (!esFechaValida(fechaPropuesta) || !/^\d{2}:\d{2}$/.test(String(horaPropuesta ?? ''))) {
    const error = new Error('La propuesta de reprogramación no es válida');
    error.statusCode = 400;
    throw error;
  }
};

const construirMensajeSolicitud = ({ tipo, cita, fechaPropuesta, horaPropuesta }) => {
  if (tipo === 'cancelacion') {
    return [
      `Solicitud de cancelación por WhatsApp para la cita #${cita.id}.`,
      `Cita actual: ${formatearFecha(cita.fecha)} a las ${horaTexto(cita.hora)}.`
    ].join(' ');
  }

  return [
    `Solicitud de reprogramación por WhatsApp para la cita #${cita.id}.`,
    `Propuesta del paciente: ${formatearFecha(fechaPropuesta)} a las ${horaTexto(horaPropuesta)}.`
  ].join(' ');
};

/**
 * Crea la solicitud pendiente y deja la cita intacta. La cancelación o el
 * movimiento real ocurren cuando recepción resuelve desde la web.
 */
const crearSolicitudCita = async ({
  conversacion,
  paciente,
  citaId,
  tipo,
  fechaPropuesta = null,
  horaPropuesta = null
}) => {
  validarPropuesta({ tipo, fechaPropuesta, horaPropuesta });

  return db.sequelize.transaction(async (transaccion) => {
    const cita = await buscarCitaDelPaciente(paciente?.id, citaId, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE
    });

    if (!esCitaGestionable(cita)) {
      return { estado: 'cita_no_disponible', cita: null, solicitud: null };
    }

    const abierta = await buscarSolicitudAbierta(cita.id, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE
    });

    if (abierta) {
      return { estado: 'duplicada', cita, solicitud: abierta };
    }

    const solicitud = await db.Solicitud.create(
      {
        pacienteId: paciente?.id ?? cita.pacienteId,
        servicioId: cita.servicioId ?? cita.servicio?.id ?? null,
        citaId: cita.id,
        conversacionId: conversacion?.id ?? null,
        mensaje: construirMensajeSolicitud({
          tipo,
          cita,
          fechaPropuesta,
          horaPropuesta
        }),
        tipo,
        estado: 'pendiente',
        origen: 'whatsapp',
        fechaSolicitud: new Date(),
        fechaPropuesta: tipo === 'reprogramacion' ? fechaPropuesta : null,
        horaPropuesta: tipo === 'reprogramacion' ? horaPropuesta : null
      },
      { transaction: transaccion }
    );

    return { estado: 'ok', cita, solicitud };
  });
};

const normalizarMensajeEscalamiento = (mensaje) => {
  if (typeof mensaje !== 'string') return '';

  const limpio = mensaje.trim();

  if (!limpio) return '';

  // Los ids de botones/listas no son texto útil para recepción.
  return /^[a-z]+:[^\s]+$/i.test(limpio) ? '' : limpio;
};

/**
 * Registra una conversación para que la atienda una persona. Si el paciente
 * insiste dentro de los 10 minutos siguientes, el mensaje se agrega a la misma
 * solicitud pendiente en lugar de crear ruido en la bandeja.
 */
const registrarEscalamiento = async ({ conversacion, paciente, mensaje }) => {
  const contenido = normalizarMensajeEscalamiento(mensaje) || MENSAJE_ESCALAMIENTO_POR_DEFECTO;

  if (!conversacion?.id && !paciente?.id) {
    const error = new Error('El escalamiento necesita una conversación o un paciente');
    error.statusCode = 400;
    throw error;
  }

  return db.sequelize.transaction(async (transaccion) => {
    const dondeConversacion = conversacion?.id
      ? { conversacionId: conversacion.id }
      : { pacienteId: paciente.id };
    const abierta = await db.Solicitud.findOne({
      where: {
        ...dondeConversacion,
        tipo: { [Op.in]: TIPOS_ESCALAMIENTO },
        estado: 'pendiente',
        updatedAt: { [Op.gte]: new Date(Date.now() - VENTANA_AGRUPACION_MS) }
      },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']],
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE
    });

    if (abierta) {
      const anterior = typeof abierta.mensaje === 'string' ? abierta.mensaje.trim() : '';
      const actualizado = [anterior, contenido].filter(Boolean).join('\n\n');

      await abierta.update({ mensaje: actualizado }, { transaction: transaccion });

      return { estado: 'agrupada', solicitud: abierta };
    }

    const solicitud = await db.Solicitud.create(
      {
        pacienteId: paciente?.id ?? conversacion?.pacienteId ?? null,
        servicioId: null,
        citaId: null,
        conversacionId: conversacion?.id ?? null,
        mensaje: contenido,
        tipo: 'consulta',
        estado: 'pendiente',
        origen: 'whatsapp',
        fechaSolicitud: new Date()
      },
      { transaction: transaccion }
    );

    return { estado: 'creada', solicitud };
  });
};

const crearSolicitudDesdeWhatsApp = async ({ conversacion, paciente, mensaje }) => {
  const contenido = typeof mensaje === 'string' ? mensaje.trim() : String(mensaje || '').trim();

  if (!contenido) {
    const error = new Error('El mensaje es requerido');
    error.statusCode = 400;
    throw error;
  }

  const solicitud = await db.Solicitud.create({
    pacienteId: paciente?.id ?? conversacion?.pacienteId ?? null,
    conversacionId: conversacion?.id ?? null,
    servicioId: null,
    citaId: null,
    mensaje: contenido,
    tipo: 'consulta',
    estado: 'pendiente',
    origen: 'whatsapp',
    fechaSolicitud: new Date()
  });

  return solicitud;
};

module.exports = {
  MAX_CITAS,
  VENTANA_AGRUPACION_MS,
  buscarSolicitudAbierta,
  crearSolicitudCita,
  crearSolicitudDesdeWhatsApp,
  listarCitasFuturas,
  obtenerCitaFutura,
  registrarEscalamiento
};
