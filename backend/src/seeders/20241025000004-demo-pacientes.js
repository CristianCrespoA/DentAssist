'use strict';
const { Op, QueryTypes } = require('sequelize');

const PACIENTES_DEMO = [
  {
    nombre: 'Laura',
    apellido: 'Gómez',
    telefono: '573001112233',
    correo: 'laura.gomez@example.com',
    fechaNacimiento: '1992-04-18',
    direccion: 'Calle 45 #12-30, Bogotá'
  },
  {
    nombre: 'Andrés',
    apellido: 'Ramírez',
    telefono: '573102223344',
    correo: 'andres.ramirez@example.com',
    fechaNacimiento: '1985-09-02',
    direccion: 'Carrera 7 #80-15, Bogotá'
  },
  {
    nombre: 'Valentina',
    apellido: 'Torres',
    telefono: '573203334455',
    correo: 'valentina.torres@example.com',
    fechaNacimiento: '2000-01-25',
    direccion: 'Calle 100 #20-45, Bogotá'
  },
  {
    nombre: 'Felipe',
    apellido: 'Herrera',
    telefono: '573154445566',
    correo: 'felipe.herrera@example.com',
    fechaNacimiento: '1978-11-11',
    direccion: 'Avenida 68 #22-10, Bogotá'
  }
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const telefonos = PACIENTES_DEMO.map((paciente) => paciente.telefono);

    const existentes = await queryInterface.sequelize.query(
      'SELECT telefono FROM Pacientes WHERE telefono IN (:telefonos)',
      { type: QueryTypes.SELECT, replacements: { telefonos } }
    );

    const telefonosExistentes = new Set(existentes.map((paciente) => paciente.telefono));

    const nuevos = PACIENTES_DEMO
      .filter((paciente) => !telefonosExistentes.has(paciente.telefono))
      .map((paciente) => ({
        ...paciente,
        usuarioId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

    if (nuevos.length) {
      await queryInterface.bulkInsert('Pacientes', nuevos, {});
    }
  },

  async down(queryInterface) {
    const telefonos = PACIENTES_DEMO.map((paciente) => paciente.telefono);

    await queryInterface.bulkDelete(
      'Pacientes',
      { telefono: { [Op.in]: telefonos } },
      {}
    );
  }
};
