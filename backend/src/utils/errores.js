const errorNegocio = (mensaje, statusCode = 400) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
};

const manejarError = (res, error) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ mensaje: error.message });
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ mensaje: 'Ya existe un registro con los mismos datos' });
  }

  console.error('Error no controlado:', error.name || 'Error');
  return res.status(500).json({ mensaje: 'Error interno del servidor' });
};

module.exports = {
  errorNegocio,
  manejarError
};
