'use strict';
const {
  Model
} = require('sequelize');
const { ESTADOS_FLUJO } = require('../utils/whatsapp');

module.exports = (sequelize, DataTypes) => {
  class Conversacion extends Model {
    static associate(models) {
      Conversacion.belongsTo(models.Paciente, { foreignKey: 'pacienteId', as: 'paciente' });
      Conversacion.hasMany(models.Mensaje, { foreignKey: 'conversacionId', as: 'mensajes' });
    }
  }

  Conversacion.init({
    telefono: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
      validate: {
        is: {
          args: /^\d{7,15}$/,
          msg: 'El teléfono debe contener entre 7 y 15 dígitos'
        }
      }
    },
    pacienteId: DataTypes.INTEGER,
    estadoFlujo: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: ESTADOS_FLUJO.INICIAL
    },
    contexto: DataTypes.JSON,
    ultimaActividad: DataTypes.DATE,
    consentimientoAceptadoEn: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Conversacion',
    tableName: 'Conversacions'
  });

  return Conversacion;
};
