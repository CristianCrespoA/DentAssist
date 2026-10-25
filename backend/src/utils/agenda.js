const { SLOT_MINUTOS } = require('../config/agenda');
const { aMinutos, formatearMinutos, seCruzan } = require('./tiempo');

const ESTADOS_SIN_OCUPAR = ['cancelada', 'no_asistio'];
const DURACION_POR_DEFECTO = 30;

const estadoOcupaHorario = (estado) => !ESTADOS_SIN_OCUPAR.includes(estado);

const generarFranjas = ({
  rangos,
  duracionMinutos,
  bloqueos = [],
  ahora = null,
  slotMinutos = SLOT_MINUTOS
}) => {
  const paso = Number.isInteger(slotMinutos) && slotMinutos > 0 ? slotMinutos : SLOT_MINUTOS;
  const franjas = new Set();

  for (const rango of rangos) {
    const inicioRango = aMinutos(rango.inicio);
    const finRango = aMinutos(rango.fin);

    if (inicioRango === null || finRango === null) continue;

    for (let inicio = inicioRango; inicio + duracionMinutos <= finRango; inicio += paso) {
      if (ahora !== null && inicio <= ahora) continue;

      const fin = inicio + duracionMinutos;
      const ocupado = bloqueos.some((bloqueo) => {
        return seCruzan(inicio, fin, bloqueo.inicio, bloqueo.fin);
      });

      if (!ocupado) {
        franjas.add(formatearMinutos(inicio));
      }
    }
  }

  return [...franjas].sort();
};

module.exports = {
  ESTADOS_SIN_OCUPAR,
  DURACION_POR_DEFECTO,
  estadoOcupaHorario,
  generarFranjas
};
