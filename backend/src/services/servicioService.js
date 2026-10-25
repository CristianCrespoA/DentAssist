const { Op } = require('sequelize');
const db = require('../models');
const { errorNegocio } = require('../utils/errores');
const { normalizarFiltroTexto, patronContiene } = require('../utils/busqueda');

const ATRIBUTOS_PUBLICOS = ['id', 'nombre', 'descripcion', 'duracionMinutos', 'precio'];

const listarServicios = async (filtros = {}) => {
  const buscar = normalizarFiltroTexto(filtros.buscar, 'buscar');
  const where = {};

  if (buscar) {
    const patron = patronContiene(buscar);
    where[Op.or] = [
      { nombre: { [Op.like]: patron } },
      { descripcion: { [Op.like]: patron } }
    ];
  }

  return db.Servicio.findAll({
    where,
    attributes: ATRIBUTOS_PUBLICOS,
    order: [['nombre', 'ASC'], ['id', 'ASC']]
  });
};

const obtenerServicio = async (id) => {
  const servicio = await db.Servicio.findByPk(id, { attributes: ATRIBUTOS_PUBLICOS });

  if (!servicio) {
    throw errorNegocio(`El servicio ${id} no existe`, 404);
  }

  return servicio;
};

module.exports = {
  listarServicios,
  obtenerServicio
};
