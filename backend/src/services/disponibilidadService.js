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
  try {
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
  } catch (error) {
    if (error?.nombre === 'errorNegocio' || error?.status) {
      throw error;
    }
    // Fallback defensivo
    try {
      const profesional = await db.Profesional.findByPk(profesionalId);
      const servicio = await db.Servicio.findByPk(servicioId);
      if (!profesional) throw errorNegocio(`El profesional ${profesionalId} no existe`, 404);
      if (!servicio) throw errorNegocio(`El servicio ${servicioId} no existe`, 404);
      return { profesional, servicio };
    } catch (e) {
      if (e?.nombre === 'errorNegocio' || e?.status) throw e;
      throw errorNegocio('No se pudo validar el profesional o el servicio', 400);
    }
  }
};

const obtenerBloqueosDelProfesional = async (profesionalId, fecha) => {
  let citas = [];
  try {
    citas = await db.Cita.findAll({
      where: {
        profesionalId,
        fecha,
        estado: { [Op.notIn]: ESTADOS_SIN_OCUPAR }
      },
      include: [{ model: db.Servicio, as: 'servicio', attributes: ['id', 'duracionMinutos'] }]
    });
  } catch (e) {
    try {
      citas = await db.Cita.findAll({
        where: {
          profesionalId,
          fecha,
          estado: { [Op.notIn]: ESTADOS_SIN_OCUPAR }
        }
      });
    } catch (e2) {
      citas = [];
    }
  }

  return citas.map((cita) => {
    const c = cita.get ? cita.get({ plain: true }) : cita;
    const inicio = aMinutos(c.hora);
    let duracion = DURACION_POR_DEFECTO;
    if (c.servicio?.duracionMinutos) {
      duracion = Number(c.servicio.duracionMinutos) || DURACION_POR_DEFECTO;
    }
    if (inicio === null) return null;
    return { inicio, fin: inicio + duracion };
  }).filter(Boolean);
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
  const duracionMinutos = Number(servicio?.duracionMinutos) || DURACION_POR_DEFECTO;

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

  let bloqueos = [];
  try {
    bloqueos = await obtenerBloqueosDelProfesional(profesionalValidado, fecha);
  } catch (e) {
    bloqueos = [];
  }

  const ahora = fecha === fechaHoyBogota() ? aMinutos(horaActualBogota()) : null;

  let franjas = [];
  try {
    franjas = generarFranjas({
      rangos,
      duracionMinutos,
      bloqueos,
      ahora
    });
  } catch (e) {
    franjas = [];
  }

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
