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

module.exports = {
  aMinutos,
  esHoraValida,
  esFechaValida,
  seCruzan
};
