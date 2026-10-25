const { Op } = require('sequelize');
const db = require('../models');
const { aMinutos, esHoraValida, esFechaValida, seCruzan } = require('../utils/tiempo');

const ESTADOS = ['programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio'];
const ESTADOS_SIN_OCUPAR = ['cancelada', 'no_asistio'];
const ESTADOS_QUE_OCUPAN = {
  [Op.notIn]: ESTADOS_SIN_OCUPAR
};
const DURACION_POR_DEFECTO = 30;

const errorNegocio = (mensaje, statusCode = 400) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
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

const formatearMinutos = (minutos) => {
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0');
  const resto = String(minutos % 60).padStart(2, '0');
  return `${horas}:${resto}`;
};

const buscarCruce = async ({ pacienteId, profesionalId, fecha, hora, duracionMinutos, excluirId }) => {
  const citas = await db.Cita.findAll({
    where: {
      fecha,
      estado: ESTADOS_QUE_OCUPAN,
      [Op.or]: [{ profesionalId }, { pacienteId }],
      ...(excluirId ? { id: { [Op.ne]: excluirId } } : {})
    },
    include: [{ model: db.Servicio, as: 'servicio', attributes: ['id', 'duracionMinutos'] }]
  });

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
  const cita = await db.Cita.findByPk(id, { include: incluirRelaciones });

  if (!cita) throw errorNegocio(`La cita ${id} no existe`, 404);

  return cita;
};

const crearCita = async (datos) => {
  validarCampos(datos);

  const servicio = await asegurarReferencias(datos);
  const duracionMinutos = Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO;

  const ocupaHorario = !ESTADOS_SIN_OCUPAR.includes(datos.estado || 'programada');

  if (ocupaHorario) {
    await buscarCruce({
      pacienteId: normalizarEntero(datos.pacienteId),
      profesionalId: normalizarEntero(datos.profesionalId),
      fecha: datos.fecha,
      hora: datos.hora,
      duracionMinutos
    });
  }

  const cita = await db.Cita.create({
    pacienteId: normalizarEntero(datos.pacienteId),
    profesionalId: normalizarEntero(datos.profesionalId),
    servicioId: normalizarEntero(datos.servicioId),
    solicitudId: normalizarOpcional(datos.solicitudId),
    fecha: datos.fecha,
    hora: datos.hora,
    estado: datos.estado || 'programada',
    observaciones: datos.observaciones || null
  });

  return obtenerCita(cita.id);
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

  const citas = await db.Cita.findAll({
    where,
    include: incluirRelaciones,
    order: [['fecha', 'ASC'], ['hora', 'ASC']]
  });

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

  const ocupaHorario = !ESTADOS_SIN_OCUPAR.includes(actualizados.estado);

  if (ocupaHorario) {
    await buscarCruce({
      pacienteId: actualizados.pacienteId,
      profesionalId: actualizados.profesionalId,
      fecha: actualizados.fecha,
      hora: actualizados.hora,
      duracionMinutos: Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO,
      excluirId: cita.id
    });
  }

  await cita.update(actualizados);

  return obtenerCita(cita.id);
};

const eliminarCita = async (id) => {
  const cita = await db.Cita.findByPk(id);

  if (!cita) throw errorNegocio(`La cita ${id} no existe`, 404);

  await cita.destroy();

  return cita;
};

module.exports = {
  ESTADOS,
  crearCita,
  listarCitas,
  actualizarCita,
  eliminarCita
};
