const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PATRON_HORA = /^(\d{1,2}):(\d{2})/;
const DURACION_POR_DEFECTO = 30;
const MINUTOS_DIA = 24 * 60;

export const ESTADOS_CITA = [
  { valor: 'programada', etiqueta: 'Programada', variante: 'warning' },
  { valor: 'confirmada', etiqueta: 'Confirmada', variante: 'info' },
  { valor: 'atendida', etiqueta: 'Atendida', variante: 'success' },
  { valor: 'cancelada', etiqueta: 'Cancelada', variante: 'neutral' },
  { valor: 'no_asistio', etiqueta: 'No asistió', variante: 'danger' },
];

export const META_ESTADO = Object.fromEntries(
  ESTADOS_CITA.map((estado) => [estado.valor, estado]),
);

const dosDigitos = (valor) => String(valor).padStart(2, '0');

export const esFechaValida = (valor) => {
  if (typeof valor !== 'string' || !PATRON_FECHA.test(valor)) return false;

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

/** Fecha actual en la zona horaria de la clínica (America/Bogota). */
export const hoyBogotaISO = () => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
};

/** Suma o resta días a una fecha ISO sin depender de la zona horaria local. */
export const sumarDias = (fecha, dias) => {
  if (!esFechaValida(fecha)) return fecha;

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));

  return `${resultado.getUTCFullYear()}-${dosDigitos(
    resultado.getUTCMonth() + 1,
  )}-${dosDigitos(resultado.getUTCDate())}`;
};

export const normalizarIdPositivo = (valor) => {
  const texto = String(valor ?? '').trim();

  if (!/^\d+$/.test(texto)) return '';

  const numero = Number(texto);
  return Number.isSafeInteger(numero) && numero > 0 ? String(numero) : '';
};

export const normalizarEstado = (valor) =>
  Object.prototype.hasOwnProperty.call(META_ESTADO, valor) ? valor : '';

export const formatearFechaLarga = (fecha) => {
  if (!esFechaValida(fecha)) return String(fecha ?? '');

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));

  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const minutosDeHora = (hora) => {
  const coincidencia = PATRON_HORA.exec(String(hora ?? ''));
  if (!coincidencia) return null;

  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);

  if (horas > 23 || minutos > 59) return null;

  return horas * 60 + minutos;
};

export const formatearHora = (hora) => {
  const minutos = minutosDeHora(hora);
  if (minutos === null) return '';

  return `${dosDigitos(Math.floor(minutos / 60))}:${dosDigitos(minutos % 60)}`;
};

export const sumarMinutos = (hora, minutos) => {
  const inicio = minutosDeHora(hora);
  if (inicio === null) return '';

  const total = (inicio + (Number(minutos) || 0) + MINUTOS_DIA) % MINUTOS_DIA;

  return `${dosDigitos(Math.floor(total / 60))}:${dosDigitos(total % 60)}`;
};

export const duracionCita = (cita) => {
  const duracion = Number(cita?.servicio?.duracionMinutos);
  return Number.isFinite(duracion) && duracion > 0
    ? duracion
    : DURACION_POR_DEFECTO;
};

/** Rango horario visible de una cita: inicio, fin calculado con la duración. */
export const rangoHorario = (cita) => {
  try {
    const inicio = formatearHora(cita?.hora);

    if (!inicio) {
      return { inicio: '', fin: '', duracionMinutos: duracionCita(cita) };
    }

    const duracion = duracionCita(cita);

    return {
      inicio,
      fin: sumarMinutos(inicio, duracion),
      duracionMinutos: duracion,
    };
  } catch (e) {
    return { inicio: '', fin: '', duracionMinutos: 30 };
  }
};

export const resumirTexto = (texto, maximo = 60) => {
  const limpio = String(texto ?? '').trim().replace(/\s+/g, ' ');

  if (!limpio) return '';
  if (limpio.length <= maximo) return limpio;

  return `${limpio.slice(0, Math.max(0, maximo - 1)).trimEnd()}…`;
};

const ordenarCitas = (citas) =>
  [...citas].sort((a, b) => {
    const inicioA = minutosDeHora(a?.hora) ?? Number.MAX_SAFE_INTEGER;
    const inicioB = minutosDeHora(b?.hora) ?? Number.MAX_SAFE_INTEGER;

    return inicioA - inicioB || Number(a?.id || 0) - Number(b?.id || 0);
  });

const compararPorFechaYHora = (a, b) => {
  const fechaA = esFechaValida(a?.fecha) ? a.fecha : '';
  const fechaB = esFechaValida(b?.fecha) ? b.fecha : '';

  if (fechaA !== fechaB) {
    if (!fechaA) return 1;
    if (!fechaB) return -1;
    return fechaA.localeCompare(fechaB);
  }

  const inicioA = minutosDeHora(a?.hora) ?? Number.MAX_SAFE_INTEGER;
  const inicioB = minutosDeHora(b?.hora) ?? Number.MAX_SAFE_INTEGER;

  return inicioA - inicioB || Number(a?.id || 0) - Number(b?.id || 0);
};

/** Agrupa las citas por fecha (ascendente) para la vista de todas las fechas. */
export const agruparCitasPorFecha = (citas = []) => {
  const lista = [...(Array.isArray(citas) ? citas : [])].sort(
    compararPorFechaYHora,
  );

  return lista.reduce((grupos, cita) => {
    const fecha = esFechaValida(cita?.fecha) ? cita.fecha : '';
    const ultimo = grupos[grupos.length - 1];

    if (ultimo && ultimo.fecha === fecha) {
      ultimo.citas.push(cita);
      return grupos;
    }

    grupos.push({
      fecha,
      etiqueta: fecha ? formatearFechaLarga(fecha) : 'Sin fecha',
      citas: [cita],
    });

    return grupos;
  }, []);
};

/** Contadores y rango horario del conjunto de citas mostrado. */
export const construirResumen = (citas = []) => {
  const lista = ordenarCitas(Array.isArray(citas) ? citas : []);
  const conteo = new Map();
  let inicio = null;
  let fin = null;

  lista.forEach((cita) => {
    const estado = normalizarEstado(cita?.estado) || 'programada';
    conteo.set(estado, (conteo.get(estado) || 0) + 1);

    const rango = rangoHorario(cita);
    const inicioMinutos = minutosDeHora(rango.inicio);
    const finMinutos = minutosDeHora(rango.fin);

    if (inicioMinutos !== null && (inicio === null || inicioMinutos < inicio.minutos)) {
      inicio = { hora: rango.inicio, minutos: inicioMinutos };
    }

    if (finMinutos !== null && (fin === null || finMinutos > fin.minutos)) {
      fin = { hora: rango.fin, minutos: finMinutos };
    }
  });

  return {
    total: lista.length,
    porEstado: ESTADOS_CITA.map((estado) => ({
      ...estado,
      total: conteo.get(estado.valor) || 0,
    })).filter((estado) => estado.total > 0),
    inicio: inicio?.hora || '',
    fin: fin?.hora || '',
    citas: lista,
  };
};
