'use strict';
const {
  Model
} = require('sequelize');
const { normalizarTelefonoDigitos } = require('../utils/telefono');
module.exports = (sequelize, DataTypes) => {
  class Paciente extends Model {
    static associate(models) {
      Paciente.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
      Paciente.hasMany(models.Solicitud, { foreignKey: 'pacienteId', as: 'solicitudes' });
      Paciente.hasMany(models.Cita, { foreignKey: 'pacienteId', as: 'citas' });
      Paciente.hasMany(models.Conversacion, { foreignKey: 'pacienteId', as: 'conversaciones' });
    }
  }
  Paciente.init({
    usuarioId: DataTypes.INTEGER,
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El nombre es obligatorio' },
        len: {
          args: [1, 100],
          msg: 'El nombre debe tener entre 1 y 100 caracteres'
        }
      }
    },
    apellido: {
      type: DataTypes.STRING,
      // Los pacientes creados desde WhatsApp pueden no tener apellido; el
      // personal lo completa después. La API web sigue exigiendo el campo.
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'El apellido no puede superar los 100 caracteres'
        }
      }
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El teléfono es obligatorio' },
        is: {
          args: /^\d{7,15}$/,
          msg: 'El teléfono debe contener entre 7 y 15 dígitos'
        }
      }
    },
    telefonoNormalizado: {
      type: DataTypes.STRING(15),
      allowNull: true,
      unique: true
    },
    origen: {
      type: DataTypes.ENUM('web', 'whatsapp', 'manual'),
      allowNull: false,
      defaultValue: 'manual'
    },
    correo: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        esCorreoValido(valor) {
          if (valor === null || valor === undefined) return;

          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
            throw new Error('El correo no tiene un formato válido');
          }
        },
        len: {
          args: [0, 255],
          msg: 'El correo no puede superar los 255 caracteres'
        }
      }
    },
    fechaNacimiento: DataTypes.DATEONLY,
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: 'La dirección no puede superar los 255 caracteres'
        }
      }
    }
  }, {
    hooks: {
      beforeValidate(paciente) {
        const normalizado = normalizarTelefonoDigitos(paciente.telefono);

        if (normalizado) {
          paciente.telefonoNormalizado = normalizado;
        }
      }
    },
    sequelize,
    modelName: 'Paciente',
    tableName: 'Pacientes'
  });
  return Paciente;
};
