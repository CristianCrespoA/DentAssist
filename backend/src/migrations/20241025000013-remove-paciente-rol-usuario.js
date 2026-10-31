'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Primero actualizamos cualquier usuario con rol 'paciente' a 'recepcionista'
    await queryInterface.sequelize.query(
      "UPDATE `Usuarios` SET `rol` = 'recepcionista' WHERE `rol` = 'paciente'"
    );
    // Cambiamos el ENUM
    await queryInterface.sequelize.query(
      "ALTER TABLE `Usuarios` MODIFY COLUMN `rol` ENUM('admin','recepcionista') NOT NULL DEFAULT 'recepcionista'"
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `Usuarios` MODIFY COLUMN `rol` ENUM('admin','recepcionista','paciente') NOT NULL DEFAULT 'paciente'"
    );
  }
};
