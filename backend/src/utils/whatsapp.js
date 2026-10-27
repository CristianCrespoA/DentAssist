// Tipos internos con los que se guarda cada mensaje.
const TIPOS_MENSAJE = [
  'texto',
  'boton',
  'interactivo',
  'imagen',
  'audio',
  'video',
  'documento',
  'sticker',
  'ubicacion',
  'contacto',
  'reaccion',
  'otro'
];

// Tipos que entiende el canal base. El resto se responde con un aviso.
const TIPOS_SOPORTADOS = ['texto', 'boton', 'interactivo'];

const MAPEO_TIPOS_META = {
  text: 'texto',
  button: 'boton',
  interactive: 'interactivo',
  image: 'imagen',
  audio: 'audio',
  video: 'video',
  document: 'documento',
  sticker: 'sticker',
  location: 'ubicacion',
  contacts: 'contacto',
  reaction: 'reaccion'
};

const DIRECCIONES = ['entrante', 'saliente'];

const ESTADOS_MENSAJE = ['recibido', 'enviado', 'entregado', 'leido', 'fallido'];

const MAPEO_ESTADOS_META = {
  sent: 'enviado',
  delivered: 'entregado',
  read: 'leido',
  failed: 'fallido'
};

// Orden de avance de los estados salientes. Evita retroceder si Meta envía
// los eventos desordenados; `fallido` siempre se registra.
const RANGO_ESTADO = {
  recibido: 0,
  enviado: 1,
  entregado: 2,
  leido: 3,
  fallido: 4
};

const ESTADOS_FLUJO = {
  INICIAL: 'inicial',
  AVISO_ENVIADO: 'aviso_enviado'
};

const MENSAJE_PRIVACIDAD = [
  '¡Hola! Soy el asistente de DentAssist.',
  'Antes de continuar, te informamos que los datos que compartas por este canal',
  '(nombre, teléfono y contenido de tus mensajes) se tratan para gestionar tus citas',
  'y solicitudes, conforme a la Ley 1581 de 2012.',
  'Al seguir escribiendo aceptas este tratamiento.',
  'Puedes solicitar acceso, corrección o eliminación de tus datos respondiendo a este chat.'
].join(' ');

const MENSAJE_TIPO_NO_SOPORTADO =
  'Por ahora solo puedo atender mensajes de texto o botones. Cuéntame tu consulta por escrito y con gusto te ayudo.';

const MOTIVO_VENTANA_CERRADA =
  'Ventana de 24 horas cerrada: se requiere una plantilla aprobada por Meta';

const mapearTipoMeta = (tipoMeta) => MAPEO_TIPOS_META[tipoMeta] || 'otro';

/**
 * Texto legible del mensaje entrante. Los tipos no soportados se guardan con
 * `null` y su payload original queda en la columna JSON.
 */
const extraerContenido = (mensaje) => {
  if (!mensaje || typeof mensaje !== 'object') return null;

  switch (mensaje.type) {
    case 'text':
      return mensaje.text?.body ?? null;
    case 'button':
      return mensaje.button?.text ?? mensaje.button?.payload ?? null;
    case 'interactive': {
      const respuesta = mensaje.interactive?.button_reply || mensaje.interactive?.list_reply;
      return respuesta?.title ?? respuesta?.id ?? null;
    }
    default:
      return null;
  }
};

const fechaDesdeTimestamp = (valor) => {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) return null;

  const fecha = new Date(numero * 1000);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

module.exports = {
  DIRECCIONES,
  ESTADOS_FLUJO,
  ESTADOS_MENSAJE,
  MAPEO_ESTADOS_META,
  MENSAJE_PRIVACIDAD,
  MENSAJE_TIPO_NO_SOPORTADO,
  MOTIVO_VENTANA_CERRADA,
  RANGO_ESTADO,
  TIPOS_MENSAJE,
  TIPOS_SOPORTADOS,
  extraerContenido,
  fechaDesdeTimestamp,
  mapearTipoMeta
};
