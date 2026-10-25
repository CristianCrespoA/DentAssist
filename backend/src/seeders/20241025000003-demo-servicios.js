'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Servicios', [
      {
        nombre: 'Limpieza Dental',
        descripcion: 'Limpieza profesional y profilaxis dental',
        precio: 50.00,
        duracionMinutos: 30,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'Consulta General',
        descripcion: 'Consulta odontológica general',
        precio: 40.00,
        duracionMinutos: 30,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'Tratamiento de Caries',
        descripcion: 'Obturación y tratamiento de caries dental',
        precio: 150.00,
        duracionMinutos: 60,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'Ortodoncia - Consulta',
        descripcion: 'Evaluación ortodóncica inicial',
        precio: 60.00,
        duracionMinutos: 45,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Servicios', null, {});
  }
};