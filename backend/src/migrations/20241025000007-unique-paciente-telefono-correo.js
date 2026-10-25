'use strict';
const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const pacientes = await queryInterface.sequelize.query(
      'SELECT id, telefono, correo FROM Pacientes',
      { type: QueryTypes.SELECT }
    );

    for (const paciente of pacientes) {
      let telefono = null;

      if (paciente.telefono !== null) {
        const digitos = String(paciente.telefono).replace(/\D/g, '');
        const sinPrefijo = digitos.startsWith('00') ? digitos.slice(2) : digitos;
        telefono = /^(3\d|60\d)\d{8}$/.test(sinPrefijo) ? `57${sinPrefijo}` : sinPrefijo || null;
      }

      const correo = paciente.correo === null
        ? null
        : String(paciente.correo).trim().toLowerCase() || null;

      if (telefono !== paciente.telefono || correo !== paciente.correo) {
        await queryInterface.sequelize.query(
          'UPDATE Pacientes SET telefono = ?, correo = ? WHERE id = ?',
          { replacements: [telefono, correo, paciente.id] }
        );
      }
    }

    const duplicadosTelefono = await queryInterface.sequelize.query(
      `SELECT telefono, COUNT(*) AS total
       FROM Pacientes
       WHERE telefono IS NOT NULL
       GROUP BY telefono
       HAVING total > 1`,
      { type: QueryTypes.SELECT }
    );

    if (duplicadosTelefono.length) {
      throw new Error(
        'Existen teléfonos duplicados en Pacientes. Normalice o corrija los duplicados antes de aplicar la migración.'
      );
    }

    const duplicadosCorreo = await queryInterface.sequelize.query(
      `SELECT correo, COUNT(*) AS total
       FROM Pacientes
       WHERE correo IS NOT NULL
       GROUP BY correo
       HAVING total > 1`,
      { type: QueryTypes.SELECT }
    );

    if (duplicadosCorreo.length) {
      throw new Error(
        'Existen correos duplicados en Pacientes. Corrija los duplicados antes de aplicar la migración.'
      );
    }

    await queryInterface.addIndex('Pacientes', ['telefono'], {
      unique: true,
      name: 'pacientes_telefono_unique'
    });

    await queryInterface.addIndex('Pacientes', ['correo'], {
      unique: true,
      name: 'pacientes_correo_unique'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('Pacientes', 'pacientes_correo_unique');
    await queryInterface.removeIndex('Pacientes', 'pacientes_telefono_unique');
  }
};
