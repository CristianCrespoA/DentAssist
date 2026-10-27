import {
  esFechaValida,
  formatearHora,
  hoyBogotaISO,
  minutosDeHora,
  normalizarEstado,
  normalizarIdPositivo,
  sumarMinutos,
} from './agenda';

/** Valores del formulario de crear/editar cita a partir de una cita o del contexto. */
export const valoresInicialesCita = (
  cita,
  { fecha, paciente, profesionalId } = {},
) => ({
  pacienteId: cita?.pacienteId
    ? String(cita.pacienteId)
    : paciente?.id
      ? String(paciente.id)
      : '',
  paciente: cita?.paciente ?? paciente ?? null,
  profesionalId: cita?.profesionalId
    ? String(cita.profesionalId)
    : profesionalId
      ? String(profesionalId)
      : '',
  servicioId: cita?.servicioId ? String(cita.servicioId) : '',
  fecha: cita?.fecha
    ? String(cita.fecha).slice(0, 10)
    : esFechaValida(fecha)
      ? fecha
      : hoyBogotaISO(),
  hora: cita?.hora ? formatearHora(cita.hora) : '',
  estado: normalizarEstado(cita?.estado) || 'programada',
  observaciones: cita?.observaciones ?? '',
});

/**
 * Validación de cliente equivalente a la del backend más las reglas propias del
 * selector de franjas. `franjas` se pasa cuando la disponibilidad ya está lista.
 */
export const validarCita = (
  valores,
  { esEdicion = false, permitirFechaPasada = false, franjas = null } = {},
) => {
  const errores = {};

  if (!normalizarIdPositivo(valores.pacienteId)) {
    errores.pacienteId = 'Selecciona un paciente.';
  }

  if (!normalizarIdPositivo(valores.profesionalId)) {
    errores.profesionalId = 'Selecciona un profesional.';
  }

  if (!normalizarIdPositivo(valores.servicioId)) {
    errores.servicioId = 'Selecciona un servicio.';
  }

  if (!esFechaValida(valores.fecha)) {
    errores.fecha = 'Selecciona una fecha válida.';
  } else if (!permitirFechaPasada && valores.fecha < hoyBogotaISO()) {
    errores.fecha = 'La fecha no puede ser anterior a hoy.';
  }

  if (!formatearHora(valores.hora)) {
    errores.hora = 'Selecciona una hora disponible.';
  } else if (Array.isArray(franjas) && !franjas.includes(formatearHora(valores.hora))) {
    errores.hora = 'Selecciona una de las horas disponibles.';
  }

  if (esEdicion && !normalizarEstado(valores.estado)) {
    errores.estado = 'Selecciona un estado válido.';
  }

  return errores;
};

export const aPayloadCita = (valores, { esEdicion = false } = {}) => {
  const observaciones = String(valores.observaciones ?? '').trim();
  const payload = {
    pacienteId: Number(valores.pacienteId),
    profesionalId: Number(valores.profesionalId),
    servicioId: Number(valores.servicioId),
    fecha: valores.fecha,
    hora: formatearHora(valores.hora),
    observaciones: observaciones || null,
  };

  if (esEdicion) {
    payload.estado = valores.estado;
  }

  return payload;
};

const CAMPOS_REQUERIDOS = {
  pacienteId: 'pacienteId',
  profesionalId: 'profesionalId',
  servicioId: 'servicioId',
  fecha: 'fecha',
  hora: 'hora',
};

const mapearCamposRequeridos = (listado) => {
  const errores = {};

  listado
    .split(',')
    .map((campo) => campo.trim())
    .filter(Boolean)
    .forEach((campo) => {
      const clave = CAMPOS_REQUERIDOS[campo];
      if (clave) {
        errores[clave] = 'Este campo es obligatorio.';
      }
    });

  return errores;
};

/**
 * Traduce el mensaje plano del backend al campo que lo originó. Los cruces de
 * horario no se asignan a un campo: el modal muestra el mensaje completo para
 * que se vea el rango ocupado.
 */
export const mapearErrorCita = (mensaje = '') => {
  const texto = String(mensaje).trim();

  if (!texto) {
    return {
      errores: {},
      general: 'No se pudo guardar la cita. Inténtalo de nuevo.',
    };
  }

  const requeridos = /(?:Campos requeridos|Los campos no pueden estar vacíos):\s*(.+)/i.exec(
    texto,
  );

  if (requeridos) {
    return { errores: mapearCamposRequeridos(requeridos[1]), general: '' };
  }

  if (/paciente/i.test(texto) && /no existe/i.test(texto)) {
    return { errores: { pacienteId: texto }, general: '' };
  }

  if (/profesional/i.test(texto) && /no existe/i.test(texto)) {
    return { errores: { profesionalId: texto }, general: '' };
  }

  if (/servicio/i.test(texto) && /no existe/i.test(texto)) {
    return { errores: { servicioId: texto }, general: '' };
  }

  if (/estado/i.test(texto)) {
    return { errores: { estado: texto }, general: '' };
  }

  if (/no atiende|fecha/i.test(texto)) {
    return { errores: { fecha: texto }, general: '' };
  }

  if (/hora|horario|alineada|no cabe|cruza|se cruza|duraci[oó]n/i.test(texto)) {
    return { errores: { hora: texto }, general: '' };
  }

  for (const campo of ['pacienteId', 'profesionalId', 'servicioId']) {
    if (new RegExp(campo, 'i').test(texto)) {
      return { errores: { [campo]: texto }, general: '' };
    }
  }

  return { errores: {}, general: texto };
};

export const formatearPrecio = (precio) => {
  const numero = Number(precio);

  if (!Number.isFinite(numero)) return '';

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 2,
  }).format(numero);
};

export const ordenarHoras = (horas = []) =>
  [...new Set(horas.map((hora) => formatearHora(hora)).filter(Boolean))].sort(
    (a, b) => minutosDeHora(a) - minutosDeHora(b),
  );

/** Indica si una hora de inicio cabe completa dentro de los rangos del día. */
export const horaCabeEnHorario = (hora, horario = [], duracionMinutos) => {
  const inicio = minutosDeHora(hora);
  const duracion = Number(duracionMinutos);

  if (
    inicio === null ||
    !Number.isFinite(duracion) ||
    duracion <= 0 ||
    !Array.isArray(horario)
  ) {
    return false;
  }

  return horario.some((rango) => {
    const inicioRango = minutosDeHora(rango?.inicio);
    const finRango = minutosDeHora(rango?.fin);

    return (
      inicioRango !== null &&
      finRango !== null &&
      inicio >= inicioRango &&
      inicio + duracion <= finRango
    );
  });
};

export const resumenHorario = (hora, duracionMinutos) => {
  const inicio = formatearHora(hora);

  if (!inicio) return { inicio: '', fin: '' };

  return { inicio, fin: sumarMinutos(inicio, duracionMinutos) };
};
