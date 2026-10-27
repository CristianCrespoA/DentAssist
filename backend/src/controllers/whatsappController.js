const { obtenerConfigWhatsapp } = require('../config/whatsapp');
const whatsappService = require('../services/whatsappService');
const { firmaValida } = require('../utils/firmaWhatsapp');
const { manejarError } = require('../utils/errores');
const { registrar, registrarError } = require('../utils/registroWhatsapp');

/**
 * Verificación del webhook que Meta hace una sola vez al configurar la URL.
 * Devuelve el challenge en texto plano cuando el token coincide.
 */
const verificar = (req, res) => {
  const config = obtenerConfigWhatsapp();
  const modo = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (modo !== 'subscribe' || !config.verifyToken || token !== config.verifyToken) {
    return res.status(403).json({ mensaje: 'Token de verificación inválido' });
  }

  return res.status(200).type('text/plain').send(String(challenge ?? ''));
};

/**
 * Recibe los eventos de Meta. La respuesta 200 se envía antes de procesar para
 * que Meta no reintente por lentitud; los errores posteriores quedan en logs.
 */
const recibir = (req, res) => {
  const config = obtenerConfigWhatsapp();

  if (!config.appSecret) {
    return res.status(503).json({ mensaje: 'WhatsApp no está configurado' });
  }

  const firma = req.get('x-hub-signature-256');
  const cuerpoCrudo = req.cuerpoCrudo;

  if (!firmaValida(cuerpoCrudo, firma, config.appSecret)) {
    registrar('webhook_firma_invalida');
    return res.status(403).json({ mensaje: 'Firma inválida' });
  }

  const payload = req.body || {};

  res.status(200).json({ recibido: true });

  setImmediate(() => {
    whatsappService
      .procesarEventoWebhook(payload)
      .catch((error) => registrarError('webhook_procesamiento', error));
  });
};

const simular = async (req, res) => {
  try {
    const { telefono, texto, boton } = req.body || {};
    const resultado = await whatsappService.simularMensajeEntrante({
      telefono,
      texto,
      boton
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  recibir,
  simular,
  verificar
};
