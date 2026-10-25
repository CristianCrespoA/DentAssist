const aMinutos = (hora) => {
  if (typeof hora !== 'string') return null;

  const partes = hora.split(':');

  if (partes.length < 2) return null;

  const horas = Number(partes[0]);
  const minutos = Number(partes[1]);

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return null;
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null;

  return horas * 60 + minutos;
};

const esHoraValida = (hora) => aMinutos(hora) !== null;

const esFechaValida = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    date.getUTCFullYear() === anio &&
    date.getUTCMonth() === mes - 1 &&
    date.getUTCDate() === dia
  );
};

const seCruzan = (inicioA, finA, inicioB, finB) => inicioA < finB && inicioB < finA;

const formatearMinutos = (minutos) => {
  const horas = String(Math.floor(minutos / 60)).padStart(2, '0');
  const resto = String(minutos % 60).padStart(2, '0');
  return `${horas}:${resto}`;
};

const fechaHoyBogota = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
};

const horaActualBogota = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());

  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;

  return `${valor('hour')}:${valor('minute')}`;
};

const esFechaFutura = (fecha) => esFechaValida(fecha) && fecha > fechaHoyBogota();

module.exports = {
  aMinutos,
  esHoraValida,
  esFechaValida,
  esFechaFutura,
  fechaHoyBogota,
  formatearMinutos,
  horaActualBogota,
  seCruzan
};
