const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op, QueryTypes } = require('sequelize');
const Sequelize = require('sequelize');
const migration = require('../src/migrations/20241025000009-solicitudes-estados-historial');

const crearEntorno = ({ solicitudes = [], historial = [], citas = [] } = {}) => {
  const estado = {
    solicitudes: solicitudes.map((solicitud) => ({ ...solicitud })),
    historial: historial.map((fila) => ({ ...fila })),
    citas: citas.map((cita) => ({ ...cita })),
    tablas: new Set(['Solicituds', 'Citas', 'Usuarios']),
    columnas: new Set(['id', 'pacienteId', 'servicioId', 'mensaje', 'estado', 'fechaSolicitud', 'createdAt', 'updatedAt']),
    cambiosEnum: [],
    constraintsEliminados: [],
    historialEnum: []
  };

  const queryInterface = {
    sequelize: {
      query: async (sql, opciones) => {
        if (sql.includes('UPDATE Solicituds s INNER JOIN Citas')) {
          for (const solicitud of estado.solicitudes) {
            const cita = estado.citas.find((item) => item.solicitudId === solicitud.id);
            if (cita) solicitud.citaId = cita.id;
          }
          return [];
        }

        assert.equal(opciones?.type, QueryTypes.SELECT);

        if (sql.includes('FROM SolicitudHistorials')) {
          return [...estado.historial]
            .sort((a, b) => a.id - b.id)
            .map((fila) => ({ ...fila }));
        }

        const coincidencia = sql.match(/estado IN \(([^)]+)\)/);
        const valores = coincidencia
          ? [...coincidencia[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
          : [];

        return estado.solicitudes
          .filter((solicitud) => valores.includes(solicitud.estado))
          .map((solicitud) => ({ id: solicitud.id, estado: solicitud.estado }));
      }
    },
    changeColumn: async (tabla, columna, definicion) => {
      assert.equal(tabla, 'Solicituds');
      assert.equal(columna, 'estado');
      estado.cambiosEnum.push([...definicion.type.values]);
    },
    addColumn: async (tabla, columna) => {
      assert.equal(tabla, 'Solicituds');
      estado.columnas.add(columna);
    },
    removeColumn: async (tabla, columna) => {
      assert.equal(tabla, 'Solicituds');
      estado.columnas.delete(columna);
    },
    addConstraint: async () => {},
    removeConstraint: async (tabla, nombre) => {
      assert.equal(tabla, 'Solicituds');
      estado.constraintsEliminados.push(nombre);
    },
    createTable: async (tabla, definicion) => {
      if (tabla === 'SolicitudHistorials') {
        estado.historialEnum = [...definicion.estadoAnterior.type.values];
      }
      estado.tablas.add(tabla);
    },
    dropTable: async (tabla) => {
      estado.tablas.delete(tabla);
    },
    bulkUpdate: async (tabla, valores, where) => {
      assert.equal(tabla, 'Solicituds');

      if (where.id) {
        const ids = where.id[Op.in] || [];
        for (const solicitud of estado.solicitudes) {
          if (ids.includes(solicitud.id)) Object.assign(solicitud, valores);
        }
        return;
      }

      const estados = where.estado?.[Op.in] || [];
      for (const solicitud of estado.solicitudes) {
        if (estados.includes(solicitud.estado)) Object.assign(solicitud, valores);
      }
    },
    bulkInsert: async (tabla, filas) => {
      assert.equal(tabla, 'SolicitudHistorials');
      const siguienteId = estado.historial.length + 1;
      estado.historial.push(
        ...filas.map((fila, indice) => ({ id: siguienteId + indice, ...fila }))
      );
    }
  };

  return { queryInterface, estado };
};

test('la migración convierte aprobada y rechazada en resuelta y conserva historial', async () => {
  const { queryInterface, estado } = crearEntorno({
    solicitudes: [
      { id: 1, estado: 'pendiente' },
      { id: 2, estado: 'aprobada' },
      { id: 3, estado: 'rechazada' }
    ],
    citas: [{ id: 50, solicitudId: 2 }]
  });

  await migration.up(queryInterface, Sequelize);

  assert.deepEqual(
    estado.solicitudes.map((solicitud) => solicitud.estado),
    ['pendiente', 'resuelta', 'resuelta']
  );
  assert.equal(estado.solicitudes[1].citaId, 50);
  assert.equal(estado.solicitudes[2].citaId, undefined);
  assert.equal(estado.historial.length, 2);

  assert.deepEqual(
    estado.historial.map((fila) => ({
      solicitudId: fila.solicitudId,
      estadoAnterior: fila.estadoAnterior,
      estadoNuevo: fila.estadoNuevo,
      usuarioId: fila.usuarioId
    })),
    [
      { solicitudId: 2, estadoAnterior: 'aprobada', estadoNuevo: 'resuelta', usuarioId: null },
      { solicitudId: 3, estadoAnterior: 'rechazada', estadoNuevo: 'resuelta', usuarioId: null }
    ]
  );

  assert.match(estado.historial[0].comentario, /aprobada/);
  assert.match(estado.historial[0].comentario, /resuelta/);
  assert.ok(estado.historial[0].createdAt instanceof Date);

  for (const columna of ['tipo', 'citaId', 'fechaPropuesta', 'horaPropuesta', 'origen']) {
    assert.ok(estado.columnas.has(columna), `Falta la columna ${columna}`);
  }

  assert.ok(estado.tablas.has('SolicitudHistorials'));
  assert.deepEqual(estado.historialEnum, [
    'pendiente',
    'aprobada',
    'rechazada',
    'en_atencion',
    'resuelta'
  ]);
  assert.deepEqual(estado.cambiosEnum.at(-1), ['pendiente', 'en_atencion', 'resuelta']);
});

test('la migración down restaura los estados originales y elimina columnas y tabla', async () => {
  const { queryInterface, estado } = crearEntorno({
    solicitudes: [
      { id: 1, estado: 'pendiente' },
      { id: 2, estado: 'resuelta' },
      { id: 3, estado: 'resuelta' },
      { id: 4, estado: 'en_atencion' },
      { id: 5, estado: 'resuelta' }
    ],
    historial: [
      { id: 1, solicitudId: 2, estadoAnterior: 'aprobada' },
      { id: 2, solicitudId: 3, estadoAnterior: 'rechazada' },
      { id: 3, solicitudId: 4, estadoAnterior: 'pendiente' },
      { id: 4, solicitudId: 5, estadoAnterior: 'pendiente' }
    ]
  });

  for (const columna of ['tipo', 'citaId', 'fechaPropuesta', 'horaPropuesta', 'origen']) {
    estado.columnas.add(columna);
  }
  estado.tablas.add('SolicitudHistorials');

  await migration.down(queryInterface, Sequelize);

  assert.deepEqual(
    estado.solicitudes.map((solicitud) => solicitud.estado),
    ['pendiente', 'aprobada', 'rechazada', 'pendiente', 'pendiente']
  );

  for (const columna of ['tipo', 'citaId', 'fechaPropuesta', 'horaPropuesta', 'origen']) {
    assert.ok(!estado.columnas.has(columna), `La columna ${columna} no se eliminó`);
  }

  assert.ok(!estado.tablas.has('SolicitudHistorials'));
  assert.deepEqual(estado.constraintsEliminados, ['Solicituds_citaId_fk']);
  assert.deepEqual(estado.cambiosEnum.at(-1), ['pendiente', 'aprobada', 'rechazada']);
});

test('down usa una equivalencia explícita si no hay historial', async () => {
  const { queryInterface, estado } = crearEntorno({
    solicitudes: [{ id: 10, estado: 'resuelta' }]
  });

  estado.tablas.add('SolicitudHistorials');

  await migration.down(queryInterface, Sequelize);

  assert.equal(estado.solicitudes[0].estado, 'aprobada');
});
