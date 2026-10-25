'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Paciente extends Model {
    static associate(models) {
      Paciente.belongsTo(models.Usuario, { foreignKey: 'usuarioId', as: 'usuario' });
      Paciente.hasMany(models.Solicitud, { foreignKey: 'pacienteId', as: 'solicitudes' });
      Paciente.hasMany(models.Cita, { foreignKey: 'pacienteId', as: 'citas' });
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
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El apellido es obligatorio' },
        len: {
          args: [1, 100],
          msg: 'El apellido debe tener entre 1 y 100 caracteres'
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
    sequelize,
    modelName: 'Paciente',
    tableName: 'Pacientes'
  });
  return Paciente;
};
