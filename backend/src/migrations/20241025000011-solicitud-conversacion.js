'use strict';

const CONSTRAINT_CONVERSACION = 'Solicituds_conversacionId_fk';
const INDICE_CONVERSACION = 'solicituds_conversacion_id_idx';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Solicituds', 'conversacionId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addConstraint('Solicituds', {
      fields: ['conversacionId'],
      type: 'foreign key',
      name: CONSTRAINT_CONVERSACION,
      references: {
        table: 'Conversacions',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Permite encontrar rápidamente las solicitudes de una conversación al
    // agrupar mensajes de escalamiento.
    await queryInterface.addIndex('Solicituds', ['conversacionId'], {
      name: INDICE_CONVERSACION
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Solicituds', INDICE_CONVERSACION);
    await queryInterface.removeConstraint('Solicituds', CONSTRAINT_CONVERSACION);
    await queryInterface.removeColumn('Solicituds', 'conversacionId');
  }
};
