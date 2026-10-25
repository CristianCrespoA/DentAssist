require('dotenv').config();

const SLOT_POR_DEFECTO = 30;

const leerSlotMinutos = (valor) => {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < 1) {
    return SLOT_POR_DEFECTO;
  }

  return numero;
};

module.exports = {
  SLOT_MINUTOS: leerSlotMinutos(process.env.SLOT_MINUTOS)
};
