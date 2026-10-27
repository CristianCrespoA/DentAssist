const crypto = require('crypto');

const PREFIJO = 'sha256=';

const calcularFirma = (cuerpo, secreto) =>
  `${PREFIJO}${crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex')}`;

/**
 * Comprueba el encabezado `X-Hub-Signature-256` de Meta con HMAC SHA-256 sobre
 * el cuerpo crudo. Usa una comparación de tiempo constante.
 */
const firmaValida = (cuerpo, encabezado, secreto) => {
  if (!secreto || !cuerpo || !encabezado || typeof encabezado !== 'string') {
    return false;
  }

  if (!Buffer.isBuffer(cuerpo) && typeof cuerpo !== 'string') return false;

  if (!encabezado.toLowerCase().startsWith(PREFIJO)) return false;

  const hexadecimal = encabezado.slice(PREFIJO.length);

  if (!/^[a-f0-9]{64}$/i.test(hexadecimal)) return false;

  const esperado = crypto.createHmac('sha256', secreto).update(cuerpo).digest();
  const recibido = Buffer.from(hexadecimal, 'hex');

  return recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);
};

module.exports = {
  calcularFirma,
  firmaValida
};
