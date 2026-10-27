import { formatearFechaLarga, formatearHora, resumirTexto } from './agenda';
import { nombreCompleto } from './pacientes';

export const LIMITE_SOLICITUDES = 10;
export const LIMITE_MAXIMO_SOLICITUDES = 100;

export const ESTADOS_SOLICITUD = [
  { valor: 'pendiente', etiqueta: 'Pendiente', variante: 'warning' },
  { valor: 'en_atencion', etiqueta: 'En atención', variante: 'info' },
  { valor: 'resuelta', etiqueta: 'Resuelta', variante: 'success' },
];

export const META_ESTADO_SOLICITUD = Object.fromEntries(
  ESTADOS_SOLICITUD.map((estado) => [estado.valor, estado]),
);

export const TIPOS_SOLICITUD = [
  { valor: 'cancelacion', etiqueta: 'Cancelación', variante: 'danger' },
  { valor: 'reprogramacion', etiqueta: 'Reprogramación', variante: 'info' },
  { valor: 'consulta', etiqueta: 'Consulta', variante: 'primary' },
  { valor: 'otra', etiqueta: 'Otra', variante: 'neutral' },
];

export const META_TIPO = Object.fromEntries(
  TIPOS_SOLICITUD.map((tipo) => [tipo.valor, tipo]),
);

export const ORIGENES_SOLICITUD = [
  { valor: 'whatsapp', etiqueta: 'WhatsApp' },
  { valor: 'web', etiqueta: 'Web' },
  { valor: 'manual', etiqueta: 'Manual' },
];

export const META_ORIGEN = Object.fromEntries(
  ORIGENES_SOLICITUD.map((origen) => [origen.valor, origen]),
);

/** Pestañas de la bandeja, en el orden en que se atienden. */
export const PESTANAS_SOLICITUD = [
  { valor: 'pendiente', etiqueta: 'Pendientes', plural: 'pendientes' },
  { valor: 'en_atencion', etiqueta: 'En atención', plural: 'en atención' },
  { valor: 'resuelta', etiqueta: 'Resueltas', plural: 'resueltas' },
  { valor: '', etiqueta: 'Todas', plural: 'solicitudes' },
];

export const normalizarEstadoSolicitud = (valor) =>
  Object.prototype.hasOwnProperty.call(META_ESTADO_SOLICITUD, valor)
    ? valor
    : '';

export const normalizarTipoSolicitud = (valor) =>
  Object.prototype.hasOwnProperty.call(META_TIPO, valor) ? valor : '';

export const nombrePacienteSolicitud = (solicitud) =>
  nombreCompleto(solicitud?.paciente);

export const estadoSolicitud = (solicitud) => ({
  valor: solicitud?.estado || '',
  etiqueta: etiquetaEstadoSolicitud(solicitud?.estado),
  variante: META_ESTADO_SOLICITUD[solicitud?.estado]?.variante || 'neutral',
});

/**
 * Los estados históricos `aprobada`/`rechazada` solo existen en filas de
 * historial migradas; se muestran con su nombre original.
 */
export const etiquetaEstadoSolicitud = (valor) => {
  if (!valor) return 'Sin estado';

  return (
    META_ESTADO_SOLICITUD[valor]?.etiqueta ||
    valor.replace(/_/g, ' ').replace(/^./, (letra) => letra.toUpperCase())
  );
};

export const varianteEstadoSolicitud = (valor) =>
  META_ESTADO_SOLICITUD[valor]?.variante || 'neutral';

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});

const formatoHora = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'America/Bogota',
});

const aFecha = (valor) => {
  if (!valor) return null;

  const fecha = valor instanceof Date ? valor : new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/** Fecha de una marca de tiempo (por ejemplo `fechaSolicitud`) en Bogotá. */
export const formatearFechaSolicitud = (valor) => {
  const fecha = aFecha(valor);

  return fecha ? formatoFecha.format(fecha) : '—';
};

/** Hora local de la clínica para una marca de tiempo. */
export const formatearHoraSolicitud = (valor) => {
  const fecha = aFecha(valor);

  return fecha ? formatoHora.format(fecha) : '—';
};

export const formatearFechaHoraSolicitud = (valor) => {
  const fecha = aFecha(valor);

  if (!fecha) return '—';

  return `${formatoFecha.format(fecha)}, ${formatoHora.format(fecha)}`;
};

export const formatearHoraPropuesta = (hora) => formatearHora(hora) || '—';

export const resumenMensaje = (mensaje, maximo = 70) =>
  resumirTexto(mensaje, maximo) || 'Sin mensaje';

export const puedeTomarEnAtencion = (solicitud) =>
  solicitud?.estado === 'pendiente';

export const puedeResolver = (solicitud) =>
  Boolean(solicitud) && solicitud.estado !== 'resuelta';

/** Texto de apoyo para revisar el efecto de resolver antes de confirmar. */
export const describirEfecto = (solicitud) => {
  const cita = solicitud?.cita;
  const tipo = solicitud?.tipo;

  if (tipo === 'cancelacion') {
    if (!cita) {
      return {
        variante: 'warning',
        titulo: 'Sin cita vinculada',
        detalle:
          'La solicitud no tiene una cita asociada; al resolver solo se cerrará la solicitud.',
      };
    }

    return {
      variante: 'danger',
      titulo: 'La cita se cancelará',
      detalle: `La cita del ${formatearFechaLarga(
        cita.fecha,
      )} a las ${formatearHora(cita.hora) || '—'} pasará a cancelada y su horario quedará libre.`,
    };
  }

  if (tipo === 'reprogramacion') {
    if (!cita) {
      return {
        variante: 'danger',
        titulo: 'Falta la cita vinculada',
        detalle:
          'La solicitud no tiene una cita asociada y el backend no podrá moverla.',
      };
    }

    if (!solicitud.fechaPropuesta || !solicitud.horaPropuesta) {
      return {
        variante: 'danger',
        titulo: 'Falta la propuesta',
        detalle:
          'La solicitud no tiene fecha y hora propuestas para reprogramar.',
      };
    }

    return {
      variante: 'info',
      titulo: 'La cita se moverá',
      detalle: `Del ${formatearFechaLarga(cita.fecha)} a las ${
        formatearHora(cita.hora) || '—'
      } al ${formatearFechaLarga(solicitud.fechaPropuesta)} a las ${
        formatearHora(solicitud.horaPropuesta) || '—'
      }.`,
    };
  }

  return {
    variante: 'success',
    titulo: 'Solo se cierra la solicitud',
    detalle: 'No se modificarán citas de la agenda.',
  };
};
