'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Servicio extends Model {
    static associate(models) {
      Servicio.hasMany(models.Solicitud, { foreignKey: 'servicioId', as: 'solicitudes' });
      Servicio.hasMany(models.Cita, { foreignKey: 'servicioId', as: 'citas' });
    }
  }
  Servicio.init({
    nombre: DataTypes.STRING,
    descripcion: DataTypes.TEXT,
    precio: DataTypes.DECIMAL,
    duracionMinutos: DataTypes.INTEGER,
    activo: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Servicio',
    tableName: 'Servicios'
  });
  return Servicio;
};