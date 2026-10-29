const authService = require('../services/authService');
const { Usuario } = require('../models');

const manejarError = (res, error, statusCodePorDefecto) => {
  return res.status(error.statusCode || statusCodePorDefecto).json({ mensaje: error.message });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Email y contraseña son requeridos' });
    }

    const resultado = await authService.login(email, password);
    return res.status(200).json(resultado);
  } catch (error) {
    return manejarError(res, error, 401);
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
    return manejarError(res, error, 400);
  }
};

const perfil = async (req, res) => {
  return res.status(200).json({ usuario: req.usuario });
};

const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: ['id', 'nombre', 'email', 'rol'],
      order: [['id', 'ASC']]
    });
    const resultado = usuarios.map((u) => {
      const plain = u.get ? u.get({ plain: true }) : u;
      const nombreCompleto = plain.nombre || '';
      const partes = nombreCompleto.trim().split(/\s+/);
      const nombre = partes.shift() || nombreCompleto;
      const apellido = partes.join(' ');
      return {
        id: plain.id,
        nombre,
        apellido,
        correo: plain.email || plain.correo,
        email: plain.email || plain.correo,
        rol: plain.rol,
        activo: true
      };
    });
    return res.status(200).json(resultado);
  } catch (error) {
    return manejarError(res, error, 500);
  }
};

module.exports = {
  login,
  register,
  perfil,
  listarUsuarios
};
