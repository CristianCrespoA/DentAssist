'use strict';
const { Model } = require('sequelize');
const { aMinutos } = require('../utils/tiempo');

module.exports = (sequelize, DataTypes) => {
  class HorarioAtencion extends Model {}

  HorarioAtencion.init({
    diaSemana: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        esDiaValido(valor) {
          if (!Number.isInteger(Number(valor)) || Number(valor) < 0 || Number(valor) > 6) {
            throw new Error('El día de la semana debe ser un entero entre 0 (domingo) y 6 (sábado)');
          }
        }
      }
    },
    horaInicio: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        esHoraValida(valor) {
          if (aMinutos(valor) === null) {
            throw new Error('La hora de inicio debe tener el formato HH:MM');
          }
        }
      }
    },
    horaFin: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        esHoraValida(valor) {
          if (aMinutos(valor) === null) {
            throw new Error('La hora de fin debe tener el formato HH:MM');
          }
        }
      }
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'HorarioAtencion',
    tableName: 'HorariosAtencion',
    validate: {
      rangoValido() {
        const inicio = aMinutos(this.horaInicio);
        const fin = aMinutos(this.horaFin);

        if (inicio !== null && fin !== null && inicio >= fin) {
          throw new Error('La hora de inicio debe ser anterior a la hora de fin');
        }
      }
    }
  });

  return HorarioAtencion;
};
