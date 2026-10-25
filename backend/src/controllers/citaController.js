const citaService = require('../services/citaService');
const { manejarError } = require('../utils/errores');

const crear = async (req, res) => {
  try {
    const cita = await citaService.crearCita(req.body);
    return res.status(201).json(cita);
  } catch (error) {
    return manejarError(res, error);
  }
};

const listar = async (req, res) => {
  try {
    const { pacienteId, profesionalId, fecha, estado } = req.query;
    const citas = await citaService.listarCitas({ pacienteId, profesionalId, fecha, estado });
    return res.status(200).json(citas);
  } catch (error) {
    return manejarError(res, error);
  }
};

const actualizar = async (req, res) => {
  try {
    const cita = await citaService.actualizarCita(req.params.id, req.body);
    return res.status(200).json(cita);
  } catch (error) {
    return manejarError(res, error);
  }
};

const eliminar = async (req, res) => {
  try {
    await citaService.eliminarCita(req.params.id);
    return res.status(200).json({ mensaje: 'Cita eliminada correctamente' });
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  crear,
  listar,
  actualizar,
  eliminar
};
