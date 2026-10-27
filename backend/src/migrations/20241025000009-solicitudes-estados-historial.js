'use strict';
const { Op, QueryTypes } = require('sequelize');

const ESTADOS_ANTERIORES = ['pendiente', 'aprobada', 'rechazada'];
const ESTADOS_NUEVOS = ['pendiente', 'en_atencion', 'resuelta'];
const ESTADOS_UNION = ['pendiente', 'aprobada', 'rechazada', 'en_atencion', 'resuelta'];
const ESTADOS_MIGRADOS = ['aprobada', 'rechazada'];
const TIPOS = ['cancelacion', 'reprogramacion', 'consulta', 'otra'];
const ORIGENES = ['whatsapp', 'web', 'manual'];
const CONSTRAINT_CITA = 'Solicituds_citaId_fk';

const cambiarEnumEstado = (queryInterface, Sequelize, valores) => {
  return queryInterface.changeColumn('Solicituds', 'estado', {
    type: Sequelize.ENUM(...valores),
    allowNull: false,
    defaultValue: 'pendiente'
  });
};

const consultarSolicitudesPorEstado = (queryInterface, estados) => {
  return queryInterface.sequelize.query(
    `SELECT id, estado FROM Solicituds WHERE estado IN (${estados.map((estado) => `'${estado}'`).join(', ')})`,
    { type: QueryTypes.SELECT }
  );
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const ahora = new Date();

    // MySQL no permite reducir un ENUM que todavía contiene valores viejos.
    // Primero se amplía, luego se migran los datos y al final se deja el ENUM final.
    await cambiarEnumEstado(queryInterface, Sequelize, ESTADOS_UNION);

    await queryInterface.addColumn('Solicituds', 'tipo', {
      type: Sequelize.ENUM(...TIPOS),
      allowNull: false,
      defaultValue: 'otra'
    });

    await queryInterface.addColumn('Solicituds', 'citaId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addConstraint('Solicituds', {
      fields: ['citaId'],
      type: 'foreign key',
      name: CONSTRAINT_CITA,
      references: {
        table: 'Citas',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('Solicituds', 'fechaPropuesta', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });

    await queryInterface.addColumn('Solicituds', 'horaPropuesta', {
      type: Sequelize.TIME,
      allowNull: true
    });

    await queryInterface.addColumn('Solicituds', 'origen', {
      type: Sequelize.ENUM(...ORIGENES),
      allowNull: false,
      defaultValue: 'whatsapp'
    });

    // Conserva el vínculo que ya existía desde Citas.solicitudId.
    await queryInterface.sequelize.query(
      'UPDATE Solicituds s INNER JOIN Citas c ON c.solicitudId = s.id SET s.citaId = c.id'
    );

    await queryInterface.createTable('SolicitudHistorials', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      solicitudId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Solicituds',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      estadoAnterior: {
        // El historial conserva los estados históricos (aprobada/rechazada)
        // para que la migración down pueda restaurarlos.
        type: Sequelize.ENUM(...ESTADOS_UNION),
        allowNull: false
      },
      estadoNuevo: {
        type: Sequelize.ENUM(...ESTADOS_UNION),
        allowNull: false
      },
      usuarioId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Usuarios',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      comentario: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    const solicitudesMigradas = await consultarSolicitudesPorEstado(
      queryInterface,
      ESTADOS_MIGRADOS
    );

    await queryInterface.bulkUpdate(
      'Solicituds',
      { estado: 'resuelta', updatedAt: ahora },
      { estado: { [Op.in]: ESTADOS_MIGRADOS } }
    );

    if (solicitudesMigradas.length) {
      await queryInterface.bulkInsert(
        'SolicitudHistorials',
        solicitudesMigradas.map((solicitud) => ({
          solicitudId: solicitud.id,
          estadoAnterior: solicitud.estado,
          estadoNuevo: 'resuelta',
          usuarioId: null,
          comentario: `Migración de datos: el estado "${solicitud.estado}" se convirtió en "resuelta".`,
          createdAt: ahora
        }))
      );
    }

    await cambiarEnumEstado(queryInterface, Sequelize, ESTADOS_NUEVOS);
  },

  async down(queryInterface, Sequelize) {
    const ahora = new Date();

    const solicitudes = await consultarSolicitudesPorEstado(
      queryInterface,
      ['en_atencion', 'resuelta']
    );

    const historial = await queryInterface.sequelize.query(
      'SELECT solicitudId, estadoAnterior FROM SolicitudHistorials ORDER BY id ASC',
      { type: QueryTypes.SELECT }
    );

    const primerEstadoAnterior = new Map();

    for (const fila of historial) {
      if (!primerEstadoAnterior.has(fila.solicitudId)) {
        primerEstadoAnterior.set(fila.solicitudId, fila.estadoAnterior);
      }
    }

    await cambiarEnumEstado(queryInterface, Sequelize, ESTADOS_UNION);

    const destinos = new Map([
      ['pendiente', []],
      ['aprobada', []],
      ['rechazada', []]
    ]);

    for (const solicitud of solicitudes) {
      const estadoAnterior = primerEstadoAnterior.get(solicitud.id);

      // Se recupera el estado original cuando el historial lo conoce. Si no,
      // se usa una equivalencia explícita para no perder la fila.
      let destino = 'aprobada';

      if (ESTADOS_ANTERIORES.includes(estadoAnterior)) {
        destino = estadoAnterior;
      } else if (solicitud.estado === 'en_atencion') {
        destino = 'pendiente';
      }

      destinos.get(destino).push(solicitud.id);
    }

    for (const [destino, ids] of destinos) {
      if (!ids.length) continue;

      await queryInterface.bulkUpdate(
        'Solicituds',
        { estado: destino, updatedAt: ahora },
        { id: { [Op.in]: ids } }
      );
    }

    await cambiarEnumEstado(queryInterface, Sequelize, ESTADOS_ANTERIORES);

    await queryInterface.removeConstraint('Solicituds', CONSTRAINT_CITA);
    await queryInterface.removeColumn('Solicituds', 'citaId');
    await queryInterface.removeColumn('Solicituds', 'tipo');
    await queryInterface.removeColumn('Solicituds', 'fechaPropuesta');
    await queryInterface.removeColumn('Solicituds', 'horaPropuesta');
    await queryInterface.removeColumn('Solicituds', 'origen');
    await queryInterface.dropTable('SolicitudHistorials');
  }
};
