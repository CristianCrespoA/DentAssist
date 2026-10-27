const API_VERSION_POR_DEFECTO = 'v23.0';

// Meta permite responder libremente durante las 24 h siguientes al último
// mensaje del paciente. Fuera de esa ventana se requiere una plantilla.
const VENTANA_SERVICIO_MS = 24 * 60 * 60 * 1000;

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Lee la configuración de WhatsApp en cada llamada para que los cambios de
 * entorno y las pruebas no queden pegados al valor de carga del módulo.
 */
const obtenerConfigWhatsapp = () => {
  const token = limpiar(process.env.WHATSAPP_TOKEN);
  const phoneNumberId = limpiar(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const apiVersion = limpiar(process.env.WHATSAPP_API_VERSION) || API_VERSION_POR_DEFECTO;

  return {
    token,
    phoneNumberId,
    verifyToken: limpiar(process.env.WHATSAPP_VERIFY_TOKEN),
    appSecret: limpiar(process.env.WHATSAPP_APP_SECRET),
    apiVersion,
    urlBase: `https://graph.facebook.com/${apiVersion}`,
    configurado: Boolean(token && phoneNumberId)
  };
};

/**
 * El simulador solo está disponible en desarrollo/pruebas. En producción hay
 * que habilitarlo de forma explícita con WHATSAPP_SIMULADOR=1.
 */
const esSimuladorHabilitado = () =>
  process.env.NODE_ENV !== 'production' || process.env.WHATSAPP_SIMULADOR === '1';

module.exports = {
  API_VERSION_POR_DEFECTO,
  VENTANA_SERVICIO_MS,
  esSimuladorHabilitado,
  obtenerConfigWhatsapp
};
