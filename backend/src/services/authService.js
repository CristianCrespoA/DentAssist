const bcrypt = require('bcryptjs');
const db = require('../models');
const { generarToken } = require('../utils/jwt');
const { esPersonal } = require('../utils/roles');

const errorNegocio = (mensaje, statusCode = 400) => {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  return error;
};

const login = async (email, password) => {
  const usuario = await db.Usuario.findOne({ where: { email } });

  if (!usuario) {
    throw errorNegocio('Credenciales inválidas', 401);
  }

  const passwordValido = bcrypt.compareSync(password, usuario.password);

  if (!passwordValido) {
    throw errorNegocio('Credenciales inválidas', 401);
  }

  // La plataforma web es de uso exclusivo del personal de la clínica.
  // Los pacientes gestionan sus citas por WhatsApp (asistente virtual).
  if (!esPersonal(usuario.rol)) {
    throw errorNegocio(
      'Acceso restringido al personal de la clínica. Si eres paciente, escríbenos por WhatsApp.',
      403
    );
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

  const rolFinal = rol || 'recepcionista';

  if (!esPersonal(rolFinal)) {
    throw errorNegocio('Rol inválido. La plataforma web es solo para personal: admin o recepcionista');
  }

  const existeUsuario = await db.Usuario.findOne({ where: { email } });

  if (existeUsuario) {
    throw errorNegocio('El correo ya está registrado');
  }

  const usuario = await db.Usuario.create({
    nombre,
    email,
    password: bcrypt.hashSync(password, 10),
    rol: rolFinal
  });

  return {
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
