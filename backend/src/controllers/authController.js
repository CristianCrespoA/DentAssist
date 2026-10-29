const authService = require('../services/authService');
const { Usuario } = require('../models');
const bcrypt = require('bcryptjs');

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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.removeHeader('ETag');

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

const obtenerUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: ['id', 'nombre', 'email', 'rol']
    });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    const plain = usuario.get ? usuario.get({ plain: true }) : usuario;
    const nombreCompleto = plain.nombre || '';
    const partes = nombreCompleto.trim().split(/\s+/);
    const nombre = partes.shift() || nombreCompleto;
    const apellido = partes.join(' ');
    return res.status(200).json({
      id: plain.id,
      nombre,
      apellido,
      correo: plain.email,
      email: plain.email,
      rol: plain.rol,
      activo: true
    });
  } catch (error) {
    return manejarError(res, error, 500);
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { nombre, apellido, correo, email, rol } = req.body;
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    const correoFinal = correo || email;
    const nombreFinal = apellido ? `${nombre || ''} ${apellido}`.trim() : nombre || usuario.nombre;
    await usuario.update({
      nombre: nombreFinal,
      email: correoFinal || usuario.email,
      rol: rol || usuario.rol
    });
    return res.status(200).json({ mensaje: 'Usuario actualizado correctamente' });
  } catch (error) {
    return manejarError(res, error, 400);
  }
};

const cambiarContrasena = async (req, res) => {
  try {
    const { password, contrasena, nuevaContrasena } = req.body;
    const nueva = password || contrasena || nuevaContrasena;
    if (!nueva) {
      return res.status(400).json({ mensaje: 'La contraseña es obligatoria' });
    }
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    await usuario.update({
      password: bcrypt.hashSync(nueva, 10)
    });
    return res.status(200).json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    return manejarError(res, error, 400);
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    if (req.usuario && req.usuario.id == req.params.id) {
      return res.status(400).json({ mensaje: 'No puedes eliminar tu propio usuario' });
    }
    await usuario.destroy();
    return res.status(200).json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    return manejarError(res, error, 400);
  }
};

module.exports = {
  login,
  register,
  perfil,
  listarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  cambiarContrasena,
  eliminarUsuario
};
