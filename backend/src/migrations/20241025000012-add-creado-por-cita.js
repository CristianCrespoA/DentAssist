'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('Citas').catch(() => ({}));
    if (!tableDefinition.creadoPor) {
      await queryInterface.addColumn('Citas', 'creadoPor', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }
  },

  async down(queryInterface) {
    const tableDefinition = await queryInterface.describeTable('Citas').catch(() => ({}));
    if (tableDefinition.creadoPor) {
      await queryInterface.removeColumn('Citas', 'creadoPor');
    }
  }
};
