'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Profesional extends Model {
    static associate(models) {
      Profesional.hasMany(models.Cita, { foreignKey: 'profesionalId', as: 'citas' });
    }
  }
  Profesional.init({
    nombre: DataTypes.STRING,
    apellido: DataTypes.STRING,
    especialidad: DataTypes.STRING,
    telefono: DataTypes.STRING,
    correo: DataTypes.STRING,
    activo: DataTypes.BOOLEAN
  }, {
    sequelize,
    modelName: 'Profesional',
    tableName: 'Profesionales'
  });
  return Profesional;
};