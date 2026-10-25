const authService = require('../services/authService');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
    }

    const resultado = await authService.login(email, password);
    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(401).json({ mensaje: error.message });
  }
};

const register = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'Nombre, email y contraseña son requeridos' });
    }

    const resultado = await authService.register(req.body);
    return res.status(201).json(resultado);
  } catch (error) {
    return res.status(400).json({ mensaje: error.message });
  }
};

const perfil = async (req, res) => {
  return res.status(200).json({ usuario: req.usuario });
};

module.exports = {
  login,
  register,
  perfil
};