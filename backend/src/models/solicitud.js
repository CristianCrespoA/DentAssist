'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Solicitud extends Model {
    static associate(models) {
      Solicitud.belongsTo(models.Paciente, { foreignKey: 'pacienteId', as: 'paciente' });
      Solicitud.belongsTo(models.Servicio, { foreignKey: 'servicioId', as: 'servicio' });
      // Cita que se atiende o reprograma desde esta solicitud.
      Solicitud.belongsTo(models.Cita, { foreignKey: 'citaId', as: 'cita' });
      // Conversación de WhatsApp que originó la solicitud, si aplica.
      Solicitud.belongsTo(models.Conversacion, {
        foreignKey: 'conversacionId',
        as: 'conversacion'
      });
      // Vínculo histórico inverso: cita que pudo haberse creado a partir de la solicitud.
      Solicitud.hasOne(models.Cita, { foreignKey: 'solicitudId', as: 'citaGenerada' });
      Solicitud.hasMany(models.SolicitudHistorial, {
        foreignKey: 'solicitudId',
        as: 'historial'
      });
    }
  }
  Solicitud.init({
    pacienteId: DataTypes.INTEGER,
    servicioId: DataTypes.INTEGER,
    citaId: DataTypes.INTEGER,
    conversacionId: DataTypes.INTEGER,
    mensaje: DataTypes.TEXT,
    tipo: DataTypes.ENUM('cancelacion', 'reprogramacion', 'consulta', 'otra'),
    estado: DataTypes.ENUM('pendiente', 'en_atencion', 'resuelta'),
    origen: DataTypes.ENUM('whatsapp', 'web', 'manual'),
    fechaSolicitud: DataTypes.DATE,
    fechaPropuesta: DataTypes.DATEONLY,
    horaPropuesta: DataTypes.TIME
  }, {
    sequelize,
    modelName: 'Solicitud',
    tableName: 'Solicituds'
  });
  return Solicitud;
};
