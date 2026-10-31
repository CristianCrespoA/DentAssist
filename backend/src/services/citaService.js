const { Op } = require('sequelize');
const db = require('../models');
const {
  aMinutos,
  esHoraValida,
  esFechaValida,
  fechaHoyBogota,
  formatearMinutos,
  seCruzan
} = require('../utils/tiempo');
const { errorNegocio } = require('../utils/errores');
const {
  DURACION_POR_DEFECTO,
  ESTADOS_SIN_OCUPAR,
  estadoOcupaHorario
} = require('../utils/agenda');
const { validarHorarioCita } = require('./agendaService');

const ESTADOS = ['programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio'];
const ESTADOS_QUE_OCUPAN = {
  [Op.notIn]: ESTADOS_SIN_OCUPAR
};

const incluirRelaciones = [
  { model: db.Paciente, as: 'paciente', attributes: ['id', 'nombre', 'apellido', 'telefono'] },
  { model: db.Profesional, as: 'profesional', attributes: ['id', 'nombre', 'apellido', 'especialidad'] },
  { model: db.Servicio, as: 'servicio', attributes: ['id', 'nombre', 'duracionMinutos', 'precio'] }
];

const esEnteroPositivo = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0;
};

const normalizarEntero = (valor) => Number(valor);

const normalizarOpcional = (valor) => (valor === undefined || valor === null || valor === '' ? null : Number(valor));

const validarCampos = (datos, { parcial = false } = {}) => {
  const requeridos = ['pacienteId', 'profesionalId', 'servicioId', 'fecha', 'hora'];

  if (!parcial) {
    const faltantes = requeridos.filter((campo) => datos[campo] === undefined || datos[campo] === null || datos[campo] === '');

    if (faltantes.length) {
      throw errorNegocio(`Campos requeridos: ${faltantes.join(', ')}`);
    }
  } else {
    const vacios = requeridos.filter((campo) => datos[campo] === null || datos[campo] === '');

    if (vacios.length) {
      throw errorNegocio(`Los campos no pueden estar vacíos: ${vacios.join(', ')}`);
    }
  }

  for (const campo of ['pacienteId', 'profesionalId', 'servicioId', 'solicitudId']) {
    if (datos[campo] !== undefined && datos[campo] !== null && datos[campo] !== '') {
      if (!esEnteroPositivo(datos[campo])) {
        throw errorNegocio(`El campo ${campo} debe ser un entero positivo`);
      }
    }
  }

  if (datos.fecha !== undefined && datos.fecha !== null && datos.fecha !== '') {
    if (!esFechaValida(datos.fecha)) {
      throw errorNegocio('La fecha debe tener el formato YYYY-MM-DD y ser válida');
    }
  }

  if (datos.hora !== undefined && datos.hora !== null && datos.hora !== '') {
    if (!esHoraValida(datos.hora)) {
      throw errorNegocio('La hora debe tener el formato HH:MM y ser válida');
    }
  }

  if (datos.estado !== undefined && !ESTADOS.includes(datos.estado)) {
    throw errorNegocio(`Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}`);
  }
};

const asegurarReferencias = async ({ pacienteId, profesionalId, servicioId, solicitudId }) => {
  const [paciente, profesional, servicio] = await Promise.all([
    db.Paciente.findByPk(pacienteId),
    db.Profesional.findByPk(profesionalId),
    db.Servicio.findByPk(servicioId)
  ]);

  if (!paciente) throw errorNegocio(`El paciente ${pacienteId} no existe`, 404);
  if (!profesional) throw errorNegocio(`El profesional ${profesionalId} no existe`, 404);
  if (!servicio) throw errorNegocio(`El servicio ${servicioId} no existe`, 404);

  if (solicitudId !== undefined && solicitudId !== null && solicitudId !== '') {
    const solicitud = await db.Solicitud.findByPk(solicitudId);

    if (!solicitud) throw errorNegocio(`La solicitud ${solicitudId} no existe`, 404);
  }

  return servicio;
};

const buscarCruce = async ({
  pacienteId,
  profesionalId,
  fecha,
  hora,
  duracionMinutos,
  excluirId,
  transaction
}) => {
  let citas = [];
  try {
    citas = await db.Cita.findAll({
      where: {
        fecha,
        estado: ESTADOS_QUE_OCUPAN,
        [Op.or]: [{ profesionalId }, { pacienteId }],
        ...(excluirId ? { id: { [Op.ne]: excluirId } } : {})
      },
      include: [{ model: db.Servicio, as: 'servicio', attributes: ['id', 'duracionMinutos'] }],
      transaction
    });
  } catch (e) {
    try {
      citas = await db.Cita.findAll({
        where: {
          fecha,
          estado: ESTADOS_QUE_OCUPAN,
          [Op.or]: [{ profesionalId }, { pacienteId }],
          ...(excluirId ? { id: { [Op.ne]: excluirId } } : {})
        },
        transaction
      });
    } catch (e2) {
      citas = [];
    }
  }

  const inicioNuevo = aMinutos(hora);
  const finNuevo = inicioNuevo + duracionMinutos;

  for (const cita of citas) {
    const inicioExistente = aMinutos(cita.hora);
    const duracionExistente = Number(cita.servicio?.duracionMinutos) || DURACION_POR_DEFECTO;
    const finExistente = inicioExistente + duracionExistente;

    if (!seCruzan(inicioNuevo, finNuevo, inicioExistente, finExistente)) continue;

    const rango = `de ${formatearMinutos(inicioExistente)} a ${formatearMinutos(finExistente)}`;

    if (Number(cita.profesionalId) === Number(profesionalId)) {
      throw errorNegocio(`El profesional ya tiene una cita el ${fecha} ${rango}`, 409);
    }

    throw errorNegocio(`El paciente ya tiene una cita el ${fecha} ${rango}`, 409);
  }
};

const obtenerCita = async (id) => {
  try {
    const cita = await db.Cita.findByPk(id, { include: incluirRelaciones });
    if (cita) return cita;
  } catch (e) {
    // continuar con fallback
  }

  try {
    const cita = await db.Cita.findByPk(id);
    if (cita) return cita.get ? cita.get({ plain: true }) : cita;
  } catch (e) {
    // continuar
  }

  throw errorNegocio(`La cita ${id} no existe`, 404);
};

const crearCita = async (datos, usuario = null) => {
  validarCampos(datos);

  const servicio = await asegurarReferencias(datos);
  const duracionMinutos = Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO;

  await validarHorarioCita({
    fecha: datos.fecha,
    hora: datos.hora,
    duracionMinutos
  });

  const ocupaHorario = estadoOcupaHorario(datos.estado || 'programada');

  if (ocupaHorario) {
    await buscarCruce({
      pacienteId: normalizarEntero(datos.pacienteId),
      profesionalId: normalizarEntero(datos.profesionalId),
      fecha: datos.fecha,
      hora: datos.hora,
      duracionMinutos
    });
  }

  const obs = datos.observaciones || null;
  const cita = await db.Cita.create({
    pacienteId: normalizarEntero(datos.pacienteId),
    profesionalId: normalizarEntero(datos.profesionalId),
    servicioId: normalizarEntero(datos.servicioId),
    solicitudId: normalizarOpcional(datos.solicitudId),
    fecha: datos.fecha,
    hora: datos.hora,
    estado: datos.estado || 'programada',
    observaciones: usuario ? (obs ? `${obs} | Asignada por: ${usuario.nombre || usuario.email} (id:${usuario.id})` : `Asignada por: ${usuario.nombre || usuario.email} (id:${usuario.id})`) : obs,
    creadoPor: usuario?.id || null
  });

  try {
    return await obtenerCita(cita.id);
  } catch (e) {
    return cita.get ? cita.get({ plain: true }) : cita;
  }
};

const listarCitas = async (filtros = {}) => {
  const where = {};

  if (filtros.fecha) {
    if (!esFechaValida(filtros.fecha)) {
      throw errorNegocio('El filtro fecha debe tener el formato YYYY-MM-DD y ser válido');
    }
    where.fecha = filtros.fecha;
  }

  for (const campo of ['pacienteId', 'profesionalId']) {
    if (filtros[campo]) {
      if (!esEnteroPositivo(filtros[campo])) {
        throw errorNegocio(`El filtro ${campo} debe ser un entero positivo`);
      }
      where[campo] = normalizarEntero(filtros[campo]);
    }
  }

  if (filtros.estado) {
    if (!ESTADOS.includes(filtros.estado)) {
      throw errorNegocio(`Estado inválido. Valores permitidos: ${ESTADOS.join(', ')}`);
    }
    where.estado = filtros.estado;
  }

  let citas = [];
  try {
    citas = await db.Cita.findAll({
      where,
      order: [['fecha', 'ASC'], ['hora', 'ASC']],
      raw: true
    });
  } catch (e) {
    try {
      citas = await db.Cita.findAll({
        where,
        order: [['fecha', 'ASC'], ['hora', 'ASC']]
      }).then((r) => (Array.isArray(r) ? r.map((x) => (x.get ? x.get({ plain: true }) : x)) : []));
    } catch (e2) {
      citas = [];
    }
  }

  return citas;
};

const actualizarCita = async (id, datos) => {
  const cita = await db.Cita.findByPk(id);

  if (!cita) throw errorNegocio(`La cita ${id} no existe`, 404);

  validarCampos(datos, { parcial: true });

  const actualizados = {
    pacienteId: datos.pacienteId !== undefined ? normalizarEntero(datos.pacienteId) : cita.pacienteId,
    profesionalId: datos.profesionalId !== undefined ? normalizarEntero(datos.profesionalId) : cita.profesionalId,
    servicioId: datos.servicioId !== undefined ? normalizarEntero(datos.servicioId) : cita.servicioId,
    solicitudId: datos.solicitudId !== undefined ? normalizarOpcional(datos.solicitudId) : cita.solicitudId,
    fecha: datos.fecha !== undefined ? datos.fecha : cita.fecha,
    hora: datos.hora !== undefined ? datos.hora : cita.hora,
    estado: datos.estado !== undefined ? datos.estado : cita.estado,
    observaciones: datos.observaciones !== undefined ? datos.observaciones : cita.observaciones
  };

  const servicio = await asegurarReferencias(actualizados);
  const duracionMinutos = Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO;

  const hoy = fechaHoyBogota();
  const esCitaHistorica = cita.fecha < hoy && actualizados.fecha < hoy;

  await validarHorarioCita({
    fecha: actualizados.fecha,
    hora: actualizados.hora,
    duracionMinutos,
    permitirFechaPasada: esCitaHistorica
  });

  const ocupaHorario = estadoOcupaHorario(actualizados.estado);

  if (ocupaHorario) {
    await buscarCruce({
      pacienteId: actualizados.pacienteId,
      profesionalId: actualizados.profesionalId,
      fecha: actualizados.fecha,
      hora: actualizados.hora,
      duracionMinutos,
      excluirId: cita.id
    });
  }

  await cita.update(actualizados);

  try {
    return await obtenerCita(cita.id);
  } catch (e) {
    return cita.get ? cita.get({ plain: true }) : cita;
  }
};

const eliminarCita = async (id) => {
  const cita = await db.Cita.findByPk(id);

  if (!cita) throw errorNegocio(`La cita ${id} no existe`, 404);

  // REQ-06: el historial de una cita activa no se borra; primero debe
  // cancelarse. La regla vive en el backend para que no dependa del cliente.
  if (cita.estado !== 'cancelada') {
    throw errorNegocio('Solo se pueden eliminar citas canceladas', 409);
  }

  await cita.destroy();

  return cita;
};

module.exports = {
  ESTADOS,
  buscarCruce,
  crearCita,
  listarCitas,
  actualizarCita,
  eliminarCita
};
