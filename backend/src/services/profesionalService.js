const { Op } = require('sequelize');
const db = require('../models');
const { errorNegocio } = require('../utils/errores');
const { normalizarFiltroTexto, patronContiene } = require('../utils/busqueda');

const ATRIBUTOS_PUBLICOS = ['id', 'nombre', 'apellido', 'especialidad'];

const listarProfesionales = async (filtros = {}) => {
  const buscar = normalizarFiltroTexto(filtros.buscar, 'buscar');
  const especialidad = normalizarFiltroTexto(filtros.especialidad, 'especialidad');
  const where = {};

  if (buscar) {
    const patron = patronContiene(buscar);
    where[Op.or] = [
      { nombre: { [Op.like]: patron } },
      { apellido: { [Op.like]: patron } },
      { especialidad: { [Op.like]: patron } }
    ];
  }

  if (especialidad) {
    where.especialidad = { [Op.like]: patronContiene(especialidad) };
  }

  return db.Profesional.findAll({
    where,
    attributes: ATRIBUTOS_PUBLICOS,
    order: [['apellido', 'ASC'], ['nombre', 'ASC'], ['id', 'ASC']]
  });
};

const obtenerProfesional = async (id) => {
  const profesional = await db.Profesional.findByPk(id, { attributes: ATRIBUTOS_PUBLICOS });

  if (!profesional) {
    throw errorNegocio(`El profesional ${id} no existe`, 404);
  }

  return profesional;
};

module.exports = {
  listarProfesionales,
  obtenerProfesional
};
