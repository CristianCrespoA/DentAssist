const { obtenerConfigWhatsapp } = require('../config/whatsapp');

const REINTENTOS_POR_DEFECTO = 3;
const ESPERA_BASE_MS = 300;
const TIEMPO_MAXIMO_MS = 10000;

class ErrorEnvioWhatsapp extends Error {
  constructor(mensaje, { status = 0, codigo = null, reintentable = false } = {}) {
    super(mensaje);
    this.name = 'ErrorEnvioWhatsapp';
    this.status = status;
    this.codigo = codigo;
    this.reintentable = reintentable;
  }
}

/**
 * Construye el cuerpo de la Graph API para un texto o un mensaje interactivo.
 */
const construirCuerpo = (telefono, contenido) => {
  const destinatario = String(telefono ?? '').replace(/\D/g, '');

  if (!destinatario) {
    throw new ErrorEnvioWhatsapp('El teléfono del destinatario no es válido');
  }

  const base = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: destinatario
  };

  if (typeof contenido === 'string') {
    return { ...base, type: 'text', text: { preview_url: false, body: contenido } };
  }

  if (contenido && typeof contenido.texto === 'string') {
    return { ...base, type: 'text', text: { preview_url: false, body: contenido.texto } };
  }

  if (contenido && contenido.tipo === 'interactivo' && contenido.interactivo) {
    return { ...base, type: 'interactive', interactive: contenido.interactivo };
  }

  throw new ErrorEnvioWhatsapp('El contenido del mensaje no es válido');
};

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Envía un mensaje por la Graph API de Meta.
 *
 * `contenido` puede ser un texto o `{ tipo: 'interactivo', interactivo: {...} }`.
 * Reintenta con backoff exponencial ante errores de red, `429` y `5xx`.
 * Nunca incluye el teléfono ni el texto en los errores.
 */
const enviarMensaje = async (telefono, contenido, opciones = {}) => {
  const config = obtenerConfigWhatsapp();

  if (!config.configurado) {
    throw new ErrorEnvioWhatsapp('WhatsApp no está configurado', {
      codigo: 'sin_configuracion'
    });
  }

  const cuerpo = construirCuerpo(telefono, contenido);
  const {
    fetchImpl = globalThis.fetch,
    reintentos = REINTENTOS_POR_DEFECTO,
    esperaBaseMs = ESPERA_BASE_MS,
    tiempoMaximoMs = TIEMPO_MAXIMO_MS
  } = opciones;

  const url = `${config.urlBase}/${config.phoneNumberId}/messages`;
  let ultimoError = new ErrorEnvioWhatsapp('No se pudo enviar el mensaje por WhatsApp');

  for (let intento = 1; intento <= reintentos; intento += 1) {
    try {
      const respuesta = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(tiempoMaximoMs)
      });

      let datos = {};

      try {
        datos = await respuesta.json();
      } catch {
        datos = {};
      }

      if (respuesta.ok) {
        return { waMessageId: datos?.messages?.[0]?.id ?? null };
      }

      const reintentable = respuesta.status === 429 || respuesta.status >= 500;

      ultimoError = new ErrorEnvioWhatsapp(
        `La API de WhatsApp respondió ${respuesta.status}`,
        {
          status: respuesta.status,
          codigo: datos?.error?.code ?? respuesta.status,
          reintentable
        }
      );

      if (!reintentable) throw ultimoError;
    } catch (error) {
      if (error instanceof ErrorEnvioWhatsapp) {
        if (!error.reintentable) throw error;
        ultimoError = error;
      } else {
        ultimoError = new ErrorEnvioWhatsapp(
          'No se pudo conectar con la API de WhatsApp',
          { codigo: error?.name ?? 'red', reintentable: true }
        );
      }
    }

    if (intento < reintentos) {
      await esperar(esperaBaseMs * 2 ** (intento - 1));
    }
  }

  throw ultimoError;
};

module.exports = {
  ErrorEnvioWhatsapp,
  construirCuerpo,
  enviarMensaje
};
