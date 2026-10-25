'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Solicitud extends Model {
    static associate(models) {
      Solicitud.belongsTo(models.Paciente, { foreignKey: 'pacienteId', as: 'paciente' });
      Solicitud.belongsTo(models.Servicio, { foreignKey: 'servicioId', as: 'servicio' });
      Solicitud.hasOne(models.Cita, { foreignKey: 'solicitudId', as: 'cita' });
    }
  }
  Solicitud.init({
    pacienteId: DataTypes.INTEGER,
    servicioId: DataTypes.INTEGER,
    mensaje: DataTypes.TEXT,
    estado: DataTypes.ENUM('pendiente', 'aprobada', 'rechazada'),
    fechaSolicitud: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Solicitud',
    tableName: 'Solicituds'
  });
  return Solicitud;
};