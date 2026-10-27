'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class SolicitudHistorial extends Model {
    static associate(models) {
      SolicitudHistorial.belongsTo(models.Solicitud, {
        foreignKey: 'solicitudId',
        as: 'solicitud'
      });
      SolicitudHistorial.belongsTo(models.Usuario, {
        foreignKey: 'usuarioId',
        as: 'usuario'
      });
    }
  }
  SolicitudHistorial.init({
    solicitudId: DataTypes.INTEGER,
    estadoAnterior: DataTypes.ENUM(
      'pendiente',
      'aprobada',
      'rechazada',
      'en_atencion',
      'resuelta'
    ),
    estadoNuevo: DataTypes.ENUM(
      'pendiente',
      'aprobada',
      'rechazada',
      'en_atencion',
      'resuelta'
    ),
    usuarioId: DataTypes.INTEGER,
    comentario: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'SolicitudHistorial',
    tableName: 'SolicitudHistorials',
    updatedAt: false
  });
  return SolicitudHistorial;
};
