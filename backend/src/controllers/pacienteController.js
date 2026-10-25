const pacienteService = require('../services/pacienteService');
const { manejarError } = require('../utils/errores');

const crear = async (req, res) => {
  try {
    const paciente = await pacienteService.crearPaciente(req.body);
    return res.status(201).json(paciente);
  } catch (error) {
    return manejarError(res, error);
  }
};

const listar = async (req, res) => {
  try {
    const { buscar, pagina, limite } = req.query;
    const resultado = await pacienteService.listarPacientes({ buscar, pagina, limite });
    return res.status(200).json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
};

const obtener = async (req, res) => {
  try {
    const paciente = await pacienteService.obtenerPaciente(req.params.id);
    return res.status(200).json(paciente);
  } catch (error) {
    return manejarError(res, error);
  }
};

const actualizar = async (req, res) => {
  try {
    const paciente = await pacienteService.actualizarPaciente(req.params.id, req.body);
    return res.status(200).json(paciente);
  } catch (error) {
    return manejarError(res, error);
  }
};

const eliminar = async (req, res) => {
  try {
    await pacienteService.eliminarPaciente(req.params.id);
    return res.status(200).json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  crear,
  listar,
  obtener,
  actualizar,
  eliminar
};
