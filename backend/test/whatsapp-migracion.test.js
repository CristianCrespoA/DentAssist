const { test } = require('node:test');
const assert = require('node:assert/strict');
const Sequelize = require('sequelize');
const { QueryTypes } = Sequelize;
const migration = require('../src/migrations/20241025000010-whatsapp-canal');

const crearEntorno = ({ pacientes = [], duplicados = [] } = {}) => {
  const estado = {
    pacientes: pacientes.map((paciente) => ({ ...paciente })),
    duplicados: duplicados.map((fila) => ({ ...fila })),
    columnas: new Set(['id', 'nombre', 'apellido', 'telefono', 'correo', 'createdAt', 'updatedAt']),
    cambios: [],
    indices: [],
    tablas: new Set(['Pacientes', 'Usuarios', 'Citas', 'Solicituds']),
    indicesEliminados: []
  };

  const queryInterface = {
    sequelize: {
      query: async (sql, opciones = {}) => {
        if (sql.includes('SELECT id, telefono FROM Pacientes')) {
          assert.equal(opciones.type, QueryTypes.SELECT);

          return estado.pacientes.map((paciente) => ({ ...paciente }));
        }

        if (sql.includes('UPDATE Pacientes SET telefonoNormalizado')) {
          const [telefono, id] = opciones.replacements;
          const paciente = estado.pacientes.find((fila) => fila.id === id);

          if (paciente) paciente.telefonoNormalizado = telefono;

          return [];
        }

        if (sql.includes('HAVING total > 1')) {
          assert.equal(opciones.type, QueryTypes.SELECT);

          return estado.duplicados.map((fila) => ({ ...fila }));
        }

        if (sql.includes("UPDATE Pacientes SET apellido = ''")) {
          for (const paciente of estado.pacientes) {
            if (paciente.apellido === null || paciente.apellido === undefined) {
              paciente.apellido = '';
            }
          }

          return [];
        }

        throw new Error(`Consulta no esperada: ${sql}`);
      }
    },
    addColumn: async (tabla, columna, definicion) => {
      assert.equal(tabla, 'Pacientes');
      estado.columnas.add(columna);
      estado.cambios.push(['addColumn', columna, definicion]);
    },
    changeColumn: async (tabla, columna, definicion) => {
      assert.equal(tabla, 'Pacientes');
      estado.cambios.push(['changeColumn', columna, definicion]);
    },
    removeColumn: async (tabla, columna) => {
      assert.equal(tabla, 'Pacientes');
      estado.columnas.delete(columna);
    },
    addIndex: async (tabla, campos, opciones = {}) => {
      estado.indices.push({ tabla, campos, opciones });
    },
    removeIndex: async (tabla, nombre) => {
      assert.equal(tabla, 'Pacientes');
      estado.indicesEliminados.push(nombre);
    },
    createTable: async (tabla) => {
      estado.tablas.add(tabla);
    },
    dropTable: async (tabla) => {
      estado.tablas.delete(tabla);
    }
  };

  return { queryInterface, estado };
};

test('la migración agrega origen, normaliza teléfonos e crea las tablas del canal', async () => {
  const { queryInterface, estado } = crearEntorno({
    pacientes: [
      { id: 1, telefono: '300 123 4567', apellido: 'Pérez' },
      { id: 2, telefono: '+57 601 123 4567', apellido: 'Gómez' },
      { id: 3, telefono: null, apellido: null }
    ]
  });

  await migration.up(queryInterface, Sequelize);

  assert.ok(estado.columnas.has('origen'));
  assert.ok(estado.columnas.has('telefonoNormalizado'));
  assert.deepEqual(
    estado.pacientes.map((paciente) => paciente.telefonoNormalizado),
    ['573001234567', '576011234567', null]
  );

  const indiceTelefono = estado.indices.find(
    (indice) => indice.opciones.name === 'pacientes_telefono_normalizado_unique'
  );
  const indiceMensajes = estado.indices.find(
    (indice) => indice.opciones.name === 'mensajes_conversacion_fecha'
  );

  assert.ok(indiceTelefono);
  assert.equal(indiceTelefono.opciones.unique, true);
  assert.deepEqual(indiceTelefono.campos, ['telefonoNormalizado']);
  assert.ok(indiceMensajes);
  assert.deepEqual(indiceMensajes.campos, ['conversacionId', 'createdAt']);

  assert.ok(estado.tablas.has('Conversacions'));
  assert.ok(estado.tablas.has('Mensajes'));

  const cambioApellido = estado.cambios.find(
    (cambio) => cambio[0] === 'changeColumn' && cambio[1] === 'apellido'
  );

  assert.equal(cambioApellido[2].allowNull, true);
});

test('la migración se detiene si encuentra teléfonos duplicados', async () => {
  const { queryInterface, estado } = crearEntorno({
    pacientes: [
      { id: 1, telefono: '3001234567' },
      { id: 2, telefono: '+57 300 123 4567' }
    ]
  });

  await assert.rejects(
    migration.up(queryInterface, Sequelize),
    /teléfonos duplicados/
  );

  assert.equal(estado.indices.length, 0);
  assert.ok(!estado.columnas.has('origen'));
  assert.ok(!estado.columnas.has('telefonoNormalizado'));
  assert.ok(!estado.tablas.has('Conversacions'));
  assert.ok(!estado.tablas.has('Mensajes'));
});

test('la migración down elimina tablas, índice y columnas nuevas', async () => {
  const { queryInterface, estado } = crearEntorno({
    pacientes: [{ id: 1, telefono: '3001234567', apellido: null }]
  });

  estado.columnas.add('origen');
  estado.columnas.add('telefonoNormalizado');
  estado.tablas.add('Conversacions');
  estado.tablas.add('Mensajes');

  await migration.down(queryInterface, Sequelize);

  assert.ok(!estado.columnas.has('origen'));
  assert.ok(!estado.columnas.has('telefonoNormalizado'));
  assert.ok(!estado.tablas.has('Conversacions'));
  assert.ok(!estado.tablas.has('Mensajes'));
  assert.deepEqual(estado.indicesEliminados, ['pacientes_telefono_normalizado_unique']);
  assert.equal(estado.pacientes[0].apellido, '');

  const cambioApellido = estado.cambios.find(
    (cambio) => cambio[0] === 'changeColumn' && cambio[1] === 'apellido'
  );

  assert.equal(cambioApellido[2].allowNull, false);
});
