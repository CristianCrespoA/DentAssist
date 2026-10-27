const CLAVES_PERMITIDAS = new Set([
  'conversacionId',
  'mensajeId',
  'pacienteId',
  'estado',
  'tipo',
  'motivo',
  'codigo'
]);

// Solo se aceptan etiquetas cortas sin espacios. Así ningún llamador puede
// colar un teléfono, un nombre o el texto de un mensaje en los logs.
const VALOR_SEGURO = /^[a-z0-9_.:-]{1,80}$/i;

const limpiarEvento = (evento) => {
  if (typeof evento !== 'string') return 'evento';

  return evento.replace(/[^a-z0-9_:-]/gi, '').slice(0, 60) || 'evento';
};

const limpiarDatos = (datos) => {
  if (!datos || typeof datos !== 'object') return {};

  const limpio = {};

  for (const [clave, valor] of Object.entries(datos)) {
    if (!CLAVES_PERMITIDAS.has(clave)) continue;
    if (valor === undefined || valor === null) continue;

    if (typeof valor === 'number' || typeof valor === 'boolean') {
      limpio[clave] = valor;
      continue;
    }

    if (typeof valor === 'string' && VALOR_SEGURO.test(valor)) {
      limpio[clave] = valor;
    }
  }

  return limpio;
};

/**
 * Log del canal de WhatsApp: únicamente eventos e identificadores internos.
 * Nunca teléfonos, nombres, mensajes ni payloads.
 */
const registrar = (evento, datos) => {
  console.log(`[whatsapp] ${limpiarEvento(evento)}`, limpiarDatos(datos));
};

const registrarError = (evento, error, datos = {}) => {
  console.error(
    `[whatsapp] ${limpiarEvento(evento)}`,
    limpiarDatos({ ...datos, codigo: error?.codigo, motivo: error?.name })
  );
};

module.exports = {
  limpiarDatos,
  registrar,
  registrarError
};
