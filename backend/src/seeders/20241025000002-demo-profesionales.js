'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('Profesionales', [
      {
        nombre: 'Carlos',
        apellido: 'Mendoza',
        especialidad: 'Odontología General',
        telefono: '555-0101',
        correo: 'carlos.mendoza@dentassist.com',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'Ana',
        apellido: 'López',
        especialidad: 'Ortodoncia',
        telefono: '555-0102',
        correo: 'ana.lopez@dentassist.com',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        nombre: 'Roberto',
        apellido: 'García',
        especialidad: 'Endodoncia',
        telefono: '555-0103',
        correo: 'roberto.garcia@dentassist.com',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Profesionales', null, {});
  }
};