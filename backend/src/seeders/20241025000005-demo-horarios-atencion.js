'use strict';
const { Op, QueryTypes } = require('sequelize');

const HORARIOS_DEMO = [
  { diaSemana: 1, horaInicio: '08:00:00', horaFin: '12:00:00' },
  { diaSemana: 1, horaInicio: '14:00:00', horaFin: '18:00:00' },
  { diaSemana: 2, horaInicio: '08:00:00', horaFin: '12:00:00' },
  { diaSemana: 2, horaInicio: '14:00:00', horaFin: '18:00:00' },
  { diaSemana: 3, horaInicio: '08:00:00', horaFin: '12:00:00' },
  { diaSemana: 3, horaInicio: '14:00:00', horaFin: '18:00:00' },
  { diaSemana: 4, horaInicio: '08:00:00', horaFin: '12:00:00' },
  { diaSemana: 4, horaInicio: '14:00:00', horaFin: '18:00:00' },
  { diaSemana: 5, horaInicio: '08:00:00', horaFin: '12:00:00' },
  { diaSemana: 5, horaInicio: '14:00:00', horaFin: '18:00:00' },
  { diaSemana: 6, horaInicio: '08:00:00', horaFin: '12:00:00' }
];

const claveHorario = ({ diaSemana, horaInicio, horaFin }) => {
  const inicio = String(horaInicio).slice(0, 5);
  const fin = String(horaFin).slice(0, 5);
  return `${Number(diaSemana)}|${inicio}|${fin}`;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const existentes = await queryInterface.sequelize.query(
      'SELECT diaSemana, horaInicio, horaFin FROM HorariosAtencion',
      { type: QueryTypes.SELECT }
    );

    const clavesExistentes = new Set(existentes.map(claveHorario));

    const nuevos = HORARIOS_DEMO
      .filter((horario) => !clavesExistentes.has(claveHorario(horario)))
      .map((horario) => ({
        ...horario,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

    if (nuevos.length) {
      await queryInterface.bulkInsert('HorariosAtencion', nuevos, {});
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'HorariosAtencion',
      {
        [Op.or]: HORARIOS_DEMO.map(({ diaSemana, horaInicio, horaFin }) => ({
          diaSemana,
          horaInicio,
          horaFin
        }))
      },
      {}
    );
  }
};
