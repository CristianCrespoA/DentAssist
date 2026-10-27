const TELEFONO_MIN = 7;
const TELEFONO_MAX = 15;

/**
 * Deja solo los dígitos de un teléfono y normaliza el formato colombiano al
 * indicativo 57. Devuelve una cadena vacía cuando no hay dígitos.
 */
const normalizarTelefonoDigitos = (valor) => {
  if (valor === undefined || valor === null) return '';
  if (typeof valor !== 'string' && typeof valor !== 'number') return '';

  const digitos = String(valor).replace(/\D/g, '');
  const sinPrefijoInternacional = digitos.startsWith('00') ? digitos.slice(2) : digitos;

  // En Colombia los móviles y fijos tienen 10 dígitos; se guardan con el 57.
  if (/^(3\d{9}|60\d{8})$/.test(sinPrefijoInternacional)) {
    return `57${sinPrefijoInternacional}`;
  }

  return sinPrefijoInternacional;
};

const esTelefonoNormalizado = (valor) =>
  typeof valor === 'string' &&
  new RegExp(`^\\d{${TELEFONO_MIN},${TELEFONO_MAX}}$`).test(valor);

module.exports = {
  TELEFONO_MAX,
  TELEFONO_MIN,
  esTelefonoNormalizado,
  normalizarTelefonoDigitos
};
