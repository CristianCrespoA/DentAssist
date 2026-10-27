'use strict';
const { QueryTypes } = require('sequelize');

const TIPOS_MENSAJE = [
  'texto',
  'boton',
  'interactivo',
  'imagen',
  'audio',
  'video',
  'documento',
  'sticker',
  'ubicacion',
  'contacto',
  'reaccion',
  'otro'
];

const ESTADOS_MENSAJE = ['recibido', 'enviado', 'entregado', 'leido', 'fallido'];
const ORIGENES = ['web', 'whatsapp', 'manual'];

// Copia local del normalizador: las migraciones no deben cambiar si mañana
// cambia la utilidad de la aplicación.
const normalizarTelefono = (telefono) => {
  if (telefono === null || telefono === undefined) return null;

  const digitos = String(telefono).replace(/\D/g, '');
  const sinPrefijo = digitos.startsWith('00') ? digitos.slice(2) : digitos;
  const normalizado = /^(3\d{9}|60\d{8})$/.test(sinPrefijo) ? `57${sinPrefijo}` : sinPrefijo;

  return normalizado || null;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const pacientes = await queryInterface.sequelize.query(
      'SELECT id, telefono FROM Pacientes',
      { type: QueryTypes.SELECT }
    );

    // Los duplicados se detectan antes de tocar el esquema: MySQL no permite
    // revertir el DDL de una migración fallida de forma transaccional.
    const telefonos = new Map();

    for (const paciente of pacientes) {
      const telefonoNormalizado = normalizarTelefono(paciente.telefono);

      if (!telefonoNormalizado) continue;

      if (telefonos.has(telefonoNormalizado)) {
        throw new Error(
          'Existen teléfonos duplicados en Pacientes. Normalice o corrija los duplicados antes de aplicar la migración.'
        );
      }

      telefonos.set(telefonoNormalizado, paciente.id);
    }

    await queryInterface.addColumn('Pacientes', 'origen', {
      type: Sequelize.ENUM(...ORIGENES),
      allowNull: false,
      defaultValue: 'manual'
    });

    await queryInterface.addColumn('Pacientes', 'telefonoNormalizado', {
      type: Sequelize.STRING(15),
      allowNull: true
    });

    // Un paciente creado desde WhatsApp puede no traer apellido.
    await queryInterface.changeColumn('Pacientes', 'apellido', {
      type: Sequelize.STRING,
      allowNull: true
    });

    for (const paciente of pacientes) {
      const telefonoNormalizado = normalizarTelefono(paciente.telefono);

      await queryInterface.sequelize.query(
        'UPDATE Pacientes SET telefonoNormalizado = ? WHERE id = ?',
        { replacements: [telefonoNormalizado, paciente.id] }
      );
    }

    await queryInterface.addIndex('Pacientes', ['telefonoNormalizado'], {
      unique: true,
      name: 'pacientes_telefono_normalizado_unique'
    });

    await queryInterface.createTable('Conversacions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      telefono: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true
      },
      pacienteId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Pacientes',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      estadoFlujo: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: 'inicial'
      },
      contexto: {
        type: Sequelize.JSON,
        allowNull: true
      },
      ultimaActividad: {
        type: Sequelize.DATE,
        allowNull: true
      },
      consentimientoAceptadoEn: {
        type: Sequelize.DATE,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable('Mensajes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      conversacionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Conversacions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      waMessageId: {
        type: Sequelize.STRING(128),
        allowNull: true,
        unique: true
      },
      direccion: {
        type: Sequelize.ENUM('entrante', 'saliente'),
        allowNull: false
      },
      tipo: {
        type: Sequelize.ENUM(...TIPOS_MENSAJE),
        allowNull: false,
        defaultValue: 'texto'
      },
      contenido: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: true
      },
      estado: {
        type: Sequelize.ENUM(...ESTADOS_MENSAJE),
        allowNull: false,
        defaultValue: 'recibido'
      },
      ocurridoEn: {
        type: Sequelize.DATE,
        allowNull: true
      },
      estadoActualizadoEn: {
        type: Sequelize.DATE,
        allowNull: true
      },
      motivoFallo: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      requierePlantilla: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('Mensajes', ['conversacionId', 'createdAt'], {
      name: 'mensajes_conversacion_fecha'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Mensajes');
    await queryInterface.dropTable('Conversacions');

    await queryInterface.removeIndex('Pacientes', 'pacientes_telefono_normalizado_unique');

    // El modelo original exige apellido; se rellena para no perder filas.
    await queryInterface.sequelize.query(
      "UPDATE Pacientes SET apellido = '' WHERE apellido IS NULL"
    );

    await queryInterface.changeColumn('Pacientes', 'apellido', {
      type: Sequelize.STRING,
      allowNull: false
    });

    await queryInterface.removeColumn('Pacientes', 'telefonoNormalizado');
    await queryInterface.removeColumn('Pacientes', 'origen');
  }
};
