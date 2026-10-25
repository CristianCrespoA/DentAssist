const db = require('../models');
const { SLOT_MINUTOS } = require('../config/agenda');
const { errorNegocio } = require('../utils/errores');
const { aMinutos, esFechaValida, fechaHoyBogota, formatearMinutos } = require('../utils/tiempo');
const { DURACION_POR_DEFECTO } = require('../utils/agenda');

const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado'
];

const normalizarHora = (hora) => String(hora).slice(0, 5);

const obtenerDiaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

const obtenerRangosDelDia = async (diaSemana, { transaction } = {}) => {
  const horarios = await db.HorarioAtencion.findAll({
    where: { diaSemana, activo: true },
    order: [['horaInicio', 'ASC'], ['horaFin', 'ASC']],
    transaction
  });

  return horarios
    .map((horario) => ({
      inicio: normalizarHora(horario.horaInicio),
      fin: normalizarHora(horario.horaFin)
    }))
    .filter((rango) => {
      const inicio = aMinutos(rango.inicio);
      const fin = aMinutos(rango.fin);
      return inicio !== null && fin !== null && inicio < fin;
    });
};

const validarFechaDisponible = (fecha) => {
  if (!esFechaValida(fecha)) {
    throw errorNegocio('La fecha debe tener el formato YYYY-MM-DD y ser válida');
  }

  if (fecha < fechaHoyBogota()) {
    throw errorNegocio('La fecha no puede ser anterior a hoy');
  }

  return fecha;
};

const validarHorarioCita = async ({ fecha, hora, duracionMinutos, permitirFechaPasada = false }) => {
  if (!esFechaValida(fecha)) {
    throw errorNegocio('La fecha debe tener el formato YYYY-MM-DD y ser válida');
  }

  // Las citas históricas se pueden seguir editando sin exigirles el horario actual.
  if (permitirFechaPasada && fecha < fechaHoyBogota()) {
    return { omitido: true };
  }

  const inicio = aMinutos(hora);

  if (inicio === null) {
    throw errorNegocio('La hora debe tener el formato HH:MM y ser válida');
  }

  const duracion = Number(duracionMinutos) || DURACION_POR_DEFECTO;
  const diaSemana = obtenerDiaSemana(fecha);
  const rangos = await obtenerRangosDelDia(diaSemana);

  if (!rangos.length) {
    throw errorNegocio(`La clínica no atiende el ${fecha} (${DIAS_SEMANA[diaSemana]})`);
  }

  const fin = inicio + duracion;

  const rango = rangos.find(({ inicio: inicioRango, fin: finRango }) => {
    return inicio >= aMinutos(inicioRango) && fin <= aMinutos(finRango);
  });

  if (!rango) {
    const horario = rangos.map(({ inicio: inicioRango, fin: finRango }) => {
      return `${inicioRango} a ${finRango}`;
    }).join(', ');

    throw errorNegocio(
      `La cita de ${duracion} minutos a las ${formatearMinutos(inicio)} no cabe en el horario de atención del ${DIAS_SEMANA[diaSemana]}: ${horario}`
    );
  }

  if ((inicio - aMinutos(rango.inicio)) % SLOT_MINUTOS !== 0) {
    throw errorNegocio(
      `La hora ${formatearMinutos(inicio)} debe estar alineada a bloques de ${SLOT_MINUTOS} minutos desde el inicio del horario (${rango.inicio})`
    );
  }

  return { inicio, fin, rangos };
};

module.exports = {
  DIAS_SEMANA,
  obtenerDiaSemana,
  obtenerRangosDelDia,
  validarFechaDisponible,
  validarHorarioCita
};
