const { Op } = require('sequelize');
const db = require('../models');
const { errorNegocio } = require('../utils/errores');
const { esFechaValida, esFechaFutura } = require('../utils/tiempo');
const { normalizarFiltroTexto, patronContiene } = require('../utils/busqueda');

const ATRIBUTOS_PUBLICOS = [
  'id',
  'nombre',
  'apellido',
  'telefono',
  'correo',
  'fechaNacimiento',
  'direccion',
  'createdAt',
  'updatedAt'
];

const NOMBRE_MAX = 100;
const CORREO_MAX = 255;
const DIRECCION_MAX = 255;
const TELEFONO_MIN = 7;
const TELEFONO_MAX = 15;
const PAGINA_POR_DEFECTO = 1;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAX = 100;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const colapsarEspacios = (valor) => valor.trim().replace(/\s+/g, ' ');

const normalizarTexto = (valor, campo, maximo) => {
  if (typeof valor !== 'string') {
    throw errorNegocio(`El campo ${campo} debe ser texto`);
  }

  const limpio = colapsarEspacios(valor);

  if (!limpio) {
    throw errorNegocio(`El campo ${campo} no puede estar vacío`);
  }

  if (limpio.length > maximo) {
    throw errorNegocio(`El campo ${campo} no puede superar los ${maximo} caracteres`);
  }

  return limpio;
};

const normalizarTextoOpcional = (valor, campo, maximo) => {
  if (valor === undefined || valor === null) return null;

  if (typeof valor !== 'string') {
    throw errorNegocio(`El campo ${campo} debe ser texto`);
  }

  const limpio = colapsarEspacios(valor);

  if (!limpio) return null;

  if (limpio.length > maximo) {
    throw errorNegocio(`El campo ${campo} no puede superar los ${maximo} caracteres`);
  }

  return limpio;
};

const normalizarTelefono = (valor) => {
  if (valor === undefined || valor === null) {
    throw errorNegocio('El teléfono es obligatorio');
  }

  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw errorNegocio('El teléfono debe ser texto o un número');
  }

  const digitos = String(valor).replace(/\D/g, '');
  const sinPrefijoInternacional = digitos.startsWith('00') ? digitos.slice(2) : digitos;

  // En Colombia los móviles y fijos tienen 10 dígitos; se guardan con el indicativo 57.
  const normalizado = /^(3\d|60\d)\d{8}$/.test(sinPrefijoInternacional)
    ? `57${sinPrefijoInternacional}`
    : sinPrefijoInternacional;

  if (!normalizado) {
    throw errorNegocio('El teléfono es obligatorio');
  }

  if (normalizado.length < TELEFONO_MIN || normalizado.length > TELEFONO_MAX) {
    throw errorNegocio(`El teléfono debe contener entre ${TELEFONO_MIN} y ${TELEFONO_MAX} dígitos`);
  }

  return normalizado;
};

const normalizarCorreo = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;

  if (typeof valor !== 'string') {
    throw errorNegocio('El correo debe ser texto');
  }

  const limpio = valor.trim().toLowerCase();

  if (!limpio) return null;

  if (limpio.length > CORREO_MAX) {
    throw errorNegocio(`El correo no puede superar los ${CORREO_MAX} caracteres`);
  }

  if (!REGEX_CORREO.test(limpio)) {
    throw errorNegocio('El correo no tiene un formato válido');
  }

  return limpio;
};

const normalizarFechaNacimiento = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;

  if (typeof valor !== 'string') {
    throw errorNegocio('La fecha de nacimiento debe ser texto con formato YYYY-MM-DD');
  }

  const limpio = valor.trim();

  if (!limpio) return null;

  if (!esFechaValida(limpio)) {
    throw errorNegocio('La fecha de nacimiento debe tener el formato YYYY-MM-DD y ser válida');
  }

  if (esFechaFutura(limpio)) {
    throw errorNegocio('La fecha de nacimiento no puede ser futura');
  }

  return limpio;
};

const normalizarDatos = (datos, { parcial = false } = {}) => {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorNegocio('El cuerpo de la solicitud debe ser un objeto JSON');
  }

  const resultado = {};

  const debeNormalizar = (campo) => !parcial || datos[campo] !== undefined;

  if (debeNormalizar('nombre')) {
    if (datos.nombre === undefined || datos.nombre === null) {
      throw errorNegocio('El nombre es obligatorio');
    }
    resultado.nombre = normalizarTexto(datos.nombre, 'nombre', NOMBRE_MAX);
  }

  if (debeNormalizar('apellido')) {
    if (datos.apellido === undefined || datos.apellido === null) {
      throw errorNegocio('El apellido es obligatorio');
    }
    resultado.apellido = normalizarTexto(datos.apellido, 'apellido', NOMBRE_MAX);
  }

  if (debeNormalizar('telefono')) {
    resultado.telefono = normalizarTelefono(datos.telefono);
  }

  if (debeNormalizar('correo')) {
    resultado.correo = normalizarCorreo(datos.correo);
  }

  if (debeNormalizar('fechaNacimiento')) {
    resultado.fechaNacimiento = normalizarFechaNacimiento(datos.fechaNacimiento);
  }

  if (debeNormalizar('direccion')) {
    resultado.direccion = normalizarTextoOpcional(datos.direccion, 'dirección', DIRECCION_MAX);
  }

  if (parcial && !Object.keys(resultado).length) {
    throw errorNegocio('No se enviaron campos para actualizar');
  }

  return resultado;
};

const buscarDuplicado = async (campo, valor, excluirId) => {
  if (valor === null || valor === undefined) return null;

  const where = { [campo]: valor };

  if (excluirId) {
    where.id = { [Op.ne]: excluirId };
  }

  return db.Paciente.findOne({ where, attributes: ['id'] });
};

const asegurarDatosUnicos = async ({ telefono, correo }, excluirId) => {
  const duplicadoTelefono = await buscarDuplicado('telefono', telefono, excluirId);

  if (duplicadoTelefono) {
    throw errorNegocio(`Ya existe un paciente con el teléfono ${telefono}`, 409);
  }

  const duplicadoCorreo = await buscarDuplicado('correo', correo, excluirId);

  if (duplicadoCorreo) {
    throw errorNegocio(`Ya existe un paciente con el correo ${correo}`, 409);
  }
};

const obtenerPaciente = async (id) => {
  const paciente = await db.Paciente.findByPk(id, { attributes: ATRIBUTOS_PUBLICOS });

  if (!paciente) {
    throw errorNegocio(`El paciente ${id} no existe`, 404);
  }

  return paciente;
};

const crearPaciente = async (datos) => {
  const normalizados = normalizarDatos(datos);

  await asegurarDatosUnicos(normalizados);

  try {
    const paciente = await db.Paciente.create(normalizados);
    return obtenerPaciente(paciente.id);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw errorNegocio('Ya existe un paciente con ese teléfono o correo', 409);
    }
    throw error;
  }
};

const parsearEnteroPositivo = (valor, campo, { porDefecto, maximo } = {}) => {
  if (valor === undefined || valor === '') return porDefecto;

  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw errorNegocio(`El parámetro ${campo} debe ser un entero positivo`);
  }

  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero < 1) {
    throw errorNegocio(`El parámetro ${campo} debe ser un entero positivo`);
  }

  if (maximo && numero > maximo) {
    throw errorNegocio(`El parámetro ${campo} no puede superar ${maximo}`);
  }

  return numero;
};

const listarPacientes = async (filtros = {}) => {
  const pagina = parsearEnteroPositivo(filtros.pagina, 'pagina', { porDefecto: PAGINA_POR_DEFECTO });
  const limite = parsearEnteroPositivo(filtros.limite, 'limite', {
    porDefecto: LIMITE_POR_DEFECTO,
    maximo: LIMITE_MAX
  });

  const where = {};
  const termino = normalizarFiltroTexto(filtros.buscar, 'buscar');

  if (termino) {
    const patron = patronContiene(termino);
    const condiciones = [
      { nombre: { [Op.like]: patron } },
      { apellido: { [Op.like]: patron } },
      { correo: { [Op.like]: patron } }
    ];

    const digitos = termino.replace(/\D/g, '');

    if (digitos) {
      condiciones.push({ telefono: { [Op.like]: patronContiene(digitos) } });
    }

    where[Op.or] = condiciones;
  }

  const { count, rows } = await db.Paciente.findAndCountAll({
    where,
    attributes: ATRIBUTOS_PUBLICOS,
    order: [['apellido', 'ASC'], ['nombre', 'ASC'], ['id', 'ASC']],
    offset: (pagina - 1) * limite,
    limit: limite
  });

  return {
    datos: rows,
    total: count,
    pagina,
    limite
  };
};

const actualizarPaciente = async (id, datos) => {
  const paciente = await db.Paciente.findByPk(id);

  if (!paciente) {
    throw errorNegocio(`El paciente ${id} no existe`, 404);
  }

  const normalizados = normalizarDatos(datos, { parcial: true });

  const telefonoFinal = normalizados.telefono !== undefined ? normalizados.telefono : paciente.telefono;
  const correoFinal = normalizados.correo !== undefined ? normalizados.correo : paciente.correo;

  await asegurarDatosUnicos({ telefono: telefonoFinal, correo: correoFinal }, paciente.id);

  try {
    await paciente.update(normalizados);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw errorNegocio('Ya existe un paciente con ese teléfono o correo', 409);
    }
    throw error;
  }

  return obtenerPaciente(paciente.id);
};

const eliminarPaciente = async (id) => {
  return db.sequelize.transaction(async (transaccion) => {
    const paciente = await db.Paciente.findByPk(id, {
      transaction: transaccion,
      lock: transaccion.LOCK.UPDATE
    });

    if (!paciente) {
      throw errorNegocio(`El paciente ${id} no existe`, 404);
    }

    const [citas, solicitudes] = await Promise.all([
      db.Cita.count({ where: { pacienteId: id }, transaction: transaccion }),
      db.Solicitud.count({ where: { pacienteId: id }, transaction: transaccion })
    ]);

    if (citas > 0) {
      throw errorNegocio(
        `No se puede eliminar el paciente porque tiene ${citas} cita(s) registrada(s). Cancele o elimine sus citas primero.`,
        409
      );
    }

    if (solicitudes > 0) {
      throw errorNegocio(
        `No se puede eliminar el paciente porque tiene ${solicitudes} solicitud(es) registrada(s). Ciérrelas primero.`,
        409
      );
    }

    await paciente.destroy({ transaction: transaccion });

    return paciente;
  });
};

module.exports = {
  crearPaciente,
  listarPacientes,
  obtenerPaciente,
  actualizarPaciente,
  eliminarPaciente
};
