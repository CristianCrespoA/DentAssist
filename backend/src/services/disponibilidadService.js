const { Op } = require('sequelize');
const db = require('../models');
const { errorNegocio } = require('../utils/errores');
const { parsearEnteroPositivo } = require('../utils/parametros');
const {
  DURACION_POR_DEFECTO,
  ESTADOS_SIN_OCUPAR,
  generarFranjas
} = require('../utils/agenda');
const {
  aMinutos,
  fechaHoyBogota,
  horaActualBogota
} = require('../utils/tiempo');
const {
  obtenerDiaSemana,
  obtenerRangosDelDia,
  validarFechaDisponible
} = require('./agendaService');

const asegurarReferencias = async (profesionalId, servicioId) => {
  const [profesional, servicio] = await Promise.all([
    db.Profesional.findByPk(profesionalId),
    db.Servicio.findByPk(servicioId)
  ]);

  if (!profesional) {
    throw errorNegocio(`El profesional ${profesionalId} no existe`, 404);
  }

  if (!servicio) {
    throw errorNegocio(`El servicio ${servicioId} no existe`, 404);
  }

  return { profesional, servicio };
};

const obtenerBloqueosDelProfesional = async (profesionalId, fecha) => {
  const citas = await db.Cita.findAll({
    where: {
      profesionalId,
      fecha,
      estado: { [Op.notIn]: ESTADOS_SIN_OCUPAR }
    },
    include: [{ model: db.Servicio, as: 'servicio', attributes: ['id', 'duracionMinutos'] }]
  });

  return citas.map((cita) => {
    const inicio = aMinutos(cita.hora);
    const duracion = Number(cita.servicio?.duracionMinutos) || DURACION_POR_DEFECTO;
    return { inicio, fin: inicio + duracion };
  });
};

const obtenerDisponibilidad = async ({ fecha, profesionalId, servicioId }) => {
  validarFechaDisponible(fecha);

  const profesionalValidado = parsearEnteroPositivo(profesionalId, 'profesionalId', {
    obligatorio: true
  });
  const servicioValidado = parsearEnteroPositivo(servicioId, 'servicioId', {
    obligatorio: true
  });

  const { servicio } = await asegurarReferencias(profesionalValidado, servicioValidado);
  const duracionMinutos = Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO;

  const diaSemana = obtenerDiaSemana(fecha);
  const rangos = await obtenerRangosDelDia(diaSemana);

  if (!rangos.length) {
    return {
      fecha,
      cerrado: true,
      horario: [],
      duracionMinutos,
      franjas: []
    };
  }

  const bloqueos = await obtenerBloqueosDelProfesional(profesionalValidado, fecha);
  const ahora = fecha === fechaHoyBogota() ? aMinutos(horaActualBogota()) : null;

  const franjas = generarFranjas({
    rangos,
    duracionMinutos,
    bloqueos,
    ahora
  });

  return {
    fecha,
    cerrado: false,
    horario: rangos,
    duracionMinutos,
    franjas
  };
};

module.exports = {
  obtenerDisponibilidad
};
