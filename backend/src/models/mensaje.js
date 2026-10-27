'use strict';
const {
  Model
} = require('sequelize');
const {
  DIRECCIONES,
  ESTADOS_MENSAJE,
  TIPOS_MENSAJE
} = require('../utils/whatsapp');

module.exports = (sequelize, DataTypes) => {
  class Mensaje extends Model {
    static associate(models) {
      Mensaje.belongsTo(models.Conversacion, {
        foreignKey: 'conversacionId',
        as: 'conversacion'
      });
    }
  }

  Mensaje.init({
    conversacionId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    waMessageId: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true
    },
    direccion: {
      type: DataTypes.ENUM(...DIRECCIONES),
      allowNull: false
    },
    tipo: {
      type: DataTypes.ENUM(...TIPOS_MENSAJE),
      allowNull: false,
      defaultValue: 'texto'
    },
    contenido: DataTypes.TEXT,
    payload: DataTypes.JSON,
    estado: {
      type: DataTypes.ENUM(...ESTADOS_MENSAJE),
      allowNull: false,
      defaultValue: 'recibido'
    },
    ocurridoEn: DataTypes.DATE,
    estadoActualizadoEn: DataTypes.DATE,
    motivoFallo: DataTypes.STRING(255),
    requierePlantilla: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'Mensaje',
    tableName: 'Mensajes',
    indexes: [
      { unique: true, fields: ['waMessageId'] },
      { fields: ['conversacionId', 'createdAt'] }
    ]
  });

  return Mensaje;
};
