const { Op } = require('sequelize');
const db = require('../models');
const { errorNegocio } = require('../utils/errores');
const { parsearEnteroPositivo } = require('../utils/parametros');
const { aMinutos, esFechaValida, seCruzan } = require('../utils/tiempo');
const { DURACION_POR_DEFECTO, ESTADOS_SIN_OCUPAR } = require('../utils/agenda');
const { validarHorarioCita } = require('./agendaService');
const { buscarCruce } = require('./citaService');
const { obtenerDisponibilidad } = require('./disponibilidadService');
const whatsappSalientes = require('./whatsappSalientes');
const { registrar, registrarError } = require('../utils/registroWhatsapp');
const { formatearFecha } = require('../utils/whatsappInteractivo');

const ESTADOS = ['pendiente', 'en_atencion', 'resuelta'];
const TIPOS = ['cancelacion', 'reprogramacion', 'consulta', 'otra'];
const PAGINA_POR_DEFECTO = 1;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAX = 100;

const TRANSICIONES = {
  pendiente: ['en_atencion', 'resuelta'],
  en_atencion: ['resuelta'],
  resuelta: []
};

const incluirListado = [
  {
    model: db.Paciente,
    as: 'paciente',
    attributes: ['id', 'nombre', 'apellido', 'telefono']
  },
  {
    model: db.Servicio,
    as: 'servicio',
    attributes: ['id', 'nombre', 'duracionMinutos', 'precio']
  },
  {
    model: db.Cita,
    as: 'cita',
    attributes: ['id', 'fecha', 'hora', 'estado', 'profesionalId', 'servicioId']
  }
];

const incluirDetalle = [
  {
    model: db.Paciente,
    as: 'paciente',
    attributes: ['id', 'nombre', 'apellido', 'telefono', 'correo']
  },
  {
    model: db.Servicio,
    as: 'servicio',
    attributes: ['id', 'nombre', 'duracionMinutos', 'precio']
  },
  {
    model: db.Cita,
    as: 'cita',
    include: [
      {
        model: db.Profesional,
        as: 'profesional',
        attributes: ['id', 'nombre', 'apellido', 'especialidad']
      }
    ]
  },
  {
    model: db.SolicitudHistorial,
    as: 'historial',
    include: [
      {
        model: db.Usuario,
        as: 'usuario',
        attributes: ['id', 'nombre', 'email', 'rol']
      }
    ]
  }
];

const validarEstado = (estado, statusCode = 409) => {
  if (!ESTADOS.includes(estado)) {
    throw errorNegocio(
      `Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}`,
      statusCode
    );
  }
};

const validarTipo = (tipo) => {
  if (!TIPOS.includes(tipo)) {
    throw errorNegocio(`Tipo inválido. Valores permitidos: ${TIPOS.join(', ')}`);
  }
};

const normalizarComentario = (valor) => {
  if (valor === undefined || valor === null) return null;

  if (typeof valor !== 'string') {
    throw errorNegocio('El comentario debe ser texto');
  }

  const limpio = valor.trim();

  return limpio || null;
};

const obtenerSolicitud = async (id) => {
  const solicitudId = parsearEnteroPositivo(id, 'id', { obligatorio: true });

  const solicitud = await db.Solicitud.findByPk(solicitudId);
  if (!solicitud) {
    throw errorNegocio(`La solicitud ${solicitudId} no existe`, 404);
  }

  let plain;
  try {
    plain = solicitud.get ? solicitud.get({ plain: true }) : solicitud;
  } catch (e) {
    plain = JSON.parse(JSON.stringify(solicitud));
  }

  try { if (plain.pacienteId) { const p = await db.Paciente.findByPk(plain.pacienteId); plain.paciente = p ? (p.get ? p.get({ plain: true }) : p) : null; } } catch (e) { console.error('SVC ERR P', e.message); }
  try { if (plain.servicioId) { const s = await db.Servicio.findByPk(plain.servicioId); plain.servicio = s ? (s.get ? s.get({ plain: true }) : s) : null; } } catch (e) { console.error('SVC ERR S', e.message); }
  try { if (plain.citaId) { const c = await db.Cita.findByPk(plain.citaId); if (c) { const pc = c.get ? c.get({ plain: true }) : c; try { if (pc.profesionalId && db.Profesional) { const pr = await db.Profesional.findByPk(pc.profesionalId); if (pr) pc.profesional = pr.get ? pr.get({ plain: true }) : pr; } } catch (e2) { console.error('SVC ERR PR', e2.message); } plain.cita = pc; } else plain.cita = null; } } catch (e) { console.error('SVC ERR C', e.message); plain.cita = null; }
  try { if (plain.conversacionId) { const conv = await db.Conversacion.findByPk(plain.conversacionId); plain.conversacion = conv ? (conv.get ? conv.get({ plain: true }) : conv) : null; if (plain.conversacion && db.Mensaje) { try { const msgs = await db.Mensaje.findAll({ where: { conversacionId: plain.conversacion.id }, order: [['ocurridoEn', 'ASC'], ['createdAt', 'ASC']] }); plain.conversacion.mensajes = msgs.map(m => (m.get ? m.get({ plain: true }) : m)); } catch (e2) { console.error('SVC ERR M', e2.message); plain.conversacion.mensajes = []; } } } } catch (e) { console.error('SVC ERR CONV', e.message); }
  try {
    const hist = await db.SolicitudHistorial.findAll({ where: { solicitudId: plain.id }, order: [['createdAt', 'ASC']] });
    plain.historial = [];
    for (const h of hist) {
      const ph = h.get ? h.get({ plain: true }) : h;
      try { if (ph.usuarioId) { const u = await db.Usuario.findByPk(ph.usuarioId, { attributes: ['id', 'nombre', 'apellido', 'email', 'rol'] }); if (u) ph.usuario = u.get ? u.get({ plain: true }) : u; } } catch (e2) { console.error('SVC ERR HU', e2.message); }
      plain.historial.push(ph);
    }
  } catch (e) { console.error('SVC ERR H', e.message); }

  return plain;
};

const listarSolicitudes = async (filtros = {}) => {
  const pagina = parsearEnteroPositivo(filtros.pagina, 'pagina', {
    porDefecto: PAGINA_POR_DEFECTO
  });
  const limite = parsearEnteroPositivo(filtros.limite, 'limite', {
    porDefecto: LIMITE_POR_DEFECTO,
    maximo: LIMITE_MAX
  });

  const where = {};

  if (filtros.estado) {
    validarEstado(filtros.estado, 400);
    where.estado = filtros.estado;
  }

  if (filtros.tipo) {
    validarTipo(filtros.tipo);
    where.tipo = filtros.tipo;
  }

  if (filtros.pacienteId) {
    where.pacienteId = parsearEnteroPositivo(filtros.pacienteId, 'pacienteId', {
      obligatorio: true
    });
  }

  if (filtros.fecha) {
    if (!esFechaValida(filtros.fecha)) {
      throw errorNegocio('El filtro fecha debe tener el formato YYYY-MM-DD y ser válido');
    }

    where.fechaSolicitud = {
      [Op.between]: [`${filtros.fecha} 00:00:00`, `${filtros.fecha} 23:59:59`]
    };
  }

  const { count, rows } = await db.Solicitud.findAndCountAll({
    where,
    include: incluirListado,
    order: [['fechaSolicitud', 'DESC'], ['id', 'DESC']],
    offset: (pagina - 1) * limite,
    limit: limite
  });

  return {
    datos: rows,
    total: count,
    pagina,
    limite
  };
};

const obtenerCitaVinculada = async (solicitud, transaccion) => {
  if (!solicitud.citaId) return null;

  const cita = await db.Cita.findByPk(solicitud.citaId, {
    transaction: transaccion,
    lock: transaccion.LOCK.UPDATE
  });

  if (!cita) {
    throw errorNegocio(`La cita ${solicitud.citaId} no existe`, 404);
  }

  return cita;
};

const obtenerAlternativas = async ({
  fecha,
  profesionalId,
  servicioId,
  pacienteId,
  excluirCitaId
}) => {
  const disponibilidad = await obtenerDisponibilidad({
    fecha,
    profesionalId,
    servicioId
  });

  if (!disponibilidad.franjas.length) return [];

  const citasPaciente = await db.Cita.findAll({
    where: {
      pacienteId,
      fecha,
      estado: { [Op.notIn]: ESTADOS_SIN_OCUPAR },
      ...(excluirCitaId ? { id: { [Op.ne]: excluirCitaId } } : {})
    },
    include: [
      {
        model: db.Servicio,
        as: 'servicio',
        attributes: ['id', 'duracionMinutos']
      }
    ]
  });

  return disponibilidad.franjas.filter((franja) => {
    const inicio = aMinutos(franja);
    const fin = inicio + disponibilidad.duracionMinutos;

    return !citasPaciente.some((cita) => {
      const inicioCita = aMinutos(cita.hora);
      const duracion = Number(cita.servicio?.duracionMinutos) || DURACION_POR_DEFECTO;

      return seCruzan(inicio, fin, inicioCita, inicioCita + duracion);
    });
  });
};

const reprogramarCita = async (solicitud, cita, transaccion) => {
  if (!solicitud.fechaPropuesta || !solicitud.horaPropuesta) {
    throw errorNegocio(
      'La solicitud no tiene fecha y hora propuestas para reprogramar'
    );
  }

  const servicio = await db.Servicio.findByPk(cita.servicioId, {
    transaction: transaccion
  });

  if (!servicio) {
    throw errorNegocio(`El servicio ${cita.servicioId} no existe`, 404);
  }

  const duracionMinutos = Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO;

  await validarHorarioCita({
    fecha: solicitud.fechaPropuesta,
    hora: solicitud.horaPropuesta,
    duracionMinutos
  });

  try {
    await buscarCruce({
      pacienteId: cita.pacienteId,
      profesionalId: cita.profesionalId,
      fecha: solicitud.fechaPropuesta,
      hora: solicitud.horaPropuesta,
      duracionMinutos,
      excluirId: cita.id,
      transaction: transaccion
    });
  } catch (error) {
    if (error.statusCode === 409) {
      error.alternativas = await obtenerAlternativas({
        fecha: solicitud.fechaPropuesta,
        profesionalId: cita.profesionalId,
        servicioId: cita.servicioId,
        pacienteId: cita.pacienteId,
        excluirCitaId: cita.id
      });
    }

    throw error;
  }

  await cita.update(
    {
      fecha: solicitud.fechaPropuesta,
      hora: solicitud.horaPropuesta
    },
    { transaction: transaccion }
  );
};

const aplicarEfectos = async (solicitud, transaccion) => {
  if (solicitud.tipo === 'cancelacion') {
    const cita = await obtenerCitaVinculada(solicitud, transaccion);

    if (cita && cita.estado !== 'cancelada') {
      await cita.update({ estado: 'cancelada' }, { transaction: transaccion });
    }

    return;
  }

  if (solicitud.tipo !== 'reprogramacion') return;

  const cita = await obtenerCitaVinculada(solicitud, transaccion);

  if (!cita) {
    throw errorNegocio(
      'La solicitud de reprogramación no tiene una cita asociada',
      409
    );
  }

  await reprogramarCita(solicitud, cita, transaccion);
};

const horaCorta = (hora) => (typeof hora === 'string' ? hora.slice(0, 5) : '');

const mensajeResolucion = (solicitud) => {
  const cita = solicitud.cita;

  if (solicitud.tipo === 'cancelacion') {
    if (cita?.fecha) {
      return `✅ Tu cita del ${formatearFecha(cita.fecha)} a las ${horaCorta(cita.hora)} quedó cancelada. El horario ya está libre. Si necesitas otra cita, escríbenos por aquí.`;
    }

    return '✅ Tu solicitud de cancelación fue atendida. Si necesitas otra cita, escríbenos por aquí.';
  }

  if (solicitud.tipo === 'reprogramacion') {
    const fecha = solicitud.fechaPropuesta || cita?.fecha;
    const hora = solicitud.horaPropuesta || cita?.hora;

    if (fecha) {
      return `✅ Tu cita quedó reprogramada para el ${formatearFecha(fecha)} a las ${horaCorta(hora)}. Te esperamos.`;
    }

    return '✅ Tu solicitud de reprogramación fue atendida.';
  }

  return '✅ Tu solicitud fue atendida. Gracias por escribirnos.';
};

const conversacionDeSolicitud = async (solicitud) => {
  if (solicitud.conversacionId) {
    return db.Conversacion.findByPk(solicitud.conversacionId);
  }

  if (!solicitud.pacienteId) return null;

  return db.Conversacion.findOne({
    where: { pacienteId: solicitud.pacienteId },
    order: [['ultimaActividad', 'DESC'], ['id', 'DESC']]
  });
};

/**
 * Avisa al paciente que su solicitud fue resuelta. Solo aplica a solicitudes
 * originadas en WhatsApp. Si la ventana de 24 h está cerrada, el saliente queda
 * registrado como fallido y marcado para enviarse con plantilla. Un fallo del
 * aviso nunca revierte la resolución.
 */
const notificarResolucion = async (solicitud) => {
  try {
    if (!solicitud || (solicitud.origen !== 'whatsapp' && !solicitud.conversacionId)) {
      return null;
    }

    const conversacion = await conversacionDeSolicitud(solicitud);

    if (!conversacion) {
      registrar('resolucion_sin_conversacion', { solicitudId: solicitud.id });
      return null;
    }

    const contenido = mensajeResolucion(solicitud);
    const mensaje = await whatsappSalientes.enviarYGuardar({
      conversacion,
      contenido,
      textoPlano: contenido
    });

    registrar('resolucion_notificada', {
      solicitudId: solicitud.id,
      mensajeId: mensaje?.id,
      estado: mensaje?.estado
    });

    return mensaje;
  } catch (error) {
    registrarError('resolucion_notificacion', error, {
      solicitudId: solicitud?.id
    });

    return null;
  }
};

const cambiarEstadoSolicitud = async (id, datos, usuario) => {
  const solicitudId = parsearEnteroPositivo(id, 'id', { obligatorio: true });

  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorNegocio('El cuerpo de la solicitud debe ser un objeto JSON');
  }

  const estadoNuevo = typeof datos.estado === 'string' ? datos.estado.trim() : '';

  if (!estadoNuevo) {
    throw errorNegocio('El estado es obligatorio');
  }

  validarEstado(estadoNuevo);

  const comentario = normalizarComentario(datos.comentario);

  await db.sequelize.transaction(async (transaccion) => {
    const solicitud = await db.Solicitud.findByPk(solicitudId, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE
    });

    if (!solicitud) {
      throw errorNegocio(`La solicitud ${solicitudId} no existe`, 404);
    }

    const transicionesPermitidas = TRANSICIONES[solicitud.estado] || [];

    if (!transicionesPermitidas.includes(estadoNuevo)) {
      throw errorNegocio(
        `No se puede cambiar la solicitud de "${solicitud.estado}" a "${estadoNuevo}"`,
        409
      );
    }

    if (estadoNuevo === 'resuelta' && !comentario) {
      throw errorNegocio(
        'El comentario es obligatorio para resolver una solicitud'
      );
    }

    if (estadoNuevo === 'resuelta') {
      await aplicarEfectos(solicitud, transaccion);
    }

    const estadoAnterior = solicitud.estado;

    await solicitud.update(
      { estado: estadoNuevo },
      { transaction: transaccion }
    );

    await db.SolicitudHistorial.create(
      {
        solicitudId: solicitud.id,
        estadoAnterior,
        estadoNuevo,
        usuarioId: usuario?.id ?? null,
        comentario
      },
      { transaction: transaccion }
    );
  });

  const solicitud = await obtenerSolicitud(solicitudId);

  if (estadoNuevo === 'resuelta') {
    await notificarResolucion(solicitud);
  }

  return solicitud;
};

module.exports = {
  ESTADOS,
  TIPOS,
  cambiarEstadoSolicitud,
  listarSolicitudes,
  obtenerSolicitud
};
