const { errorNegocio } = require('./errores');

const normalizarFiltroTexto = (valor, campo) => {
  if (valor === undefined || valor === null) return '';

  if (typeof valor !== 'string') {
    throw errorNegocio(`El parámetro ${campo} debe ser texto`);
  }

  return valor.trim();
};

const escaparLike = (texto) => texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);

const patronContiene = (texto) => `%${escaparLike(texto)}%`;

module.exports = {
  normalizarFiltroTexto,
  escaparLike,
  patronContiene
};
