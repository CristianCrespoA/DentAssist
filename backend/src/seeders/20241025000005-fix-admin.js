'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate('Usuarios', 
      { 
        password: bcrypt.hashSync('admin123', 10),
        updatedAt: new Date()
      }, 
      { email: 'admin@dentassist.com' }
    );
  },

  async down(queryInterface, Sequelize) {
  }
};
