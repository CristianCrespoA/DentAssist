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
    nombre: DataTypes.STRING,
    apellido: DataTypes.STRING,
    telefono: DataTypes.STRING,
    correo: DataTypes.STRING,
    fechaNacimiento: DataTypes.DATEONLY,
    direccion: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Paciente',
    tableName: 'Pacientes'
  });
  return Paciente;
};