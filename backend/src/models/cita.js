'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Cita extends Model {
    static associate(models) {
      Cita.belongsTo(models.Paciente, { foreignKey: 'pacienteId', as: 'paciente' });
      Cita.belongsTo(models.Profesional, { foreignKey: 'profesionalId', as: 'profesional' });
      Cita.belongsTo(models.Servicio, { foreignKey: 'servicioId', as: 'servicio' });
      Cita.belongsTo(models.Solicitud, { foreignKey: 'solicitudId', as: 'solicitud' });
    }
  }
  Cita.init({
    pacienteId: DataTypes.INTEGER,
    profesionalId: DataTypes.INTEGER,
    servicioId: DataTypes.INTEGER,
    solicitudId: DataTypes.INTEGER,
    fecha: DataTypes.DATEONLY,
    hora: DataTypes.TIME,
    estado: DataTypes.ENUM('programada', 'confirmada', 'atendida', 'cancelada', 'no_asistio'),
    observaciones: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'Cita',
    tableName: 'Citas'
  });
  return Cita;
};