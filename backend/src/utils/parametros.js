const { errorNegocio } = require('./errores');

const parsearEnteroPositivo = (valor, campo, { porDefecto, maximo, obligatorio = false } = {}) => {
  if (valor === undefined || valor === null || valor === '') {
    if (porDefecto !== undefined) return porDefecto;

    if (obligatorio) {
      throw errorNegocio(`El parámetro ${campo} es obligatorio`);
    }

    return undefined;
  }

  const numero = typeof valor === 'number'
    ? valor
    : (typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : NaN);

  if (!Number.isInteger(numero) || numero < 1) {
    throw errorNegocio(`El parámetro ${campo} debe ser un entero positivo`);
  }

  if (maximo && numero > maximo) {
    throw errorNegocio(`El parámetro ${campo} no puede superar ${maximo}`);
  }

  return numero;
};

module.exports = {
  parsearEnteroPositivo
};
