const bcrypt = require('bcryptjs');
const db = require('../models');
const { generarToken } = require('../utils/jwt');

const login = async (email, password) => {
  const usuario = await db.Usuario.findOne({ where: { email } });

  if (!usuario) {
    throw new Error('Credenciales inválidas');
  }

  const passwordValido = bcrypt.compareSync(password, usuario.password);

  if (!passwordValido) {
    throw new Error('Credenciales inválidas');
  }

  const token = generarToken({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  });

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    }
  };
};

const register = async (datos) => {
  const { nombre, email, password, rol } = datos;

  const existeUsuario = await db.Usuario.findOne({ where: { email } });

  if (existeUsuario) {
    throw new Error('El correo ya está registrado');
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const usuario = await db.Usuario.create({
    nombre,
    email,
    password: passwordHash,
    rol: rol || 'paciente'
  });

  const token = generarToken({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol
  });

  return {
    token,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol
    }
  };
};

module.exports = {
  login,
  register
};