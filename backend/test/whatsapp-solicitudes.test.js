'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const db = require('../src/models');
const { fechaHoyBogota } = require('../src/utils/tiempo');
const {
  MAX_CITAS,
  VENTANA_AGRUPACION_MS,
  crearSolicitudCita,
  listarCitasFuturas,
  registrarEscalamiento
} = require('../src/services/solicitudWhatsappService');

const TRANSACCION = { id: 'transaccion-1', LOCK: { UPDATE: 'UPDATE' } };

const sumarDias = (fecha, dias) => {
  const valor = new Date(`${fecha}T00:00:00Z`);

  valor.setUTCDate(valor.getUTCDate() + dias);

  return valor.toISOString().slice(0, 10);
};

const FECHA = sumarDias(fechaHoyBogota(), 3);

const crearCita = (datos = {}) => ({
  id: 40,
  pacienteId: 5,
  servicioId: 1,
  profesionalId: 7,
  fecha: FECHA,
  hora: '08:00:00',
  estado: 'confirmada',
  servicio: { id: 1, nombre: 'Limpieza dental', duracionMinutos: 30 },
  ...datos
});

const simularTransaccion = (t) => {
  t.mock.method(db.sequelize, 'transaction', async (callback) => callback(TRANSACCION));
};

const simularCita = (t, cita) => {
  const consultas = [];

  t.mock.method(db.Cita, 'findOne', async (opciones) => {
    consultas.push(opciones);
    return cita;
  });

  return consultas;
};

const simularSolicitudAbierta = (t, abierta) => {
  const consultas = [];

  t.mock.method(db.Solicitud, 'findOne', async (opciones) => {
    consultas.push(opciones);
    return abierta;
  });

  return consultas;
};

const simularCreacion = (t) => {
  const creadas = [];

  t.mock.method(db.Solicitud, 'create', async (datos, opciones) => {
    creadas.push({ datos, opciones });
    return { id: 90 + creadas.length, ...datos };
  });

  return creadas;
};

test('lista solo citas futuras gestionables, con servicio y límite de WhatsApp', async (t) => {
  let opcionesConsulta = null;

  t.mock.method(db.Cita, 'findAll', async (opciones) => {
    opcionesConsulta = opciones;
    return [crearCita()];
  });

  const citas = await listarCitasFuturas(5);

  assert.equal(citas.length, 1);
  assert.deepEqual(opcionesConsulta.where.pacienteId, 5);
  assert.deepEqual(opcionesConsulta.where.estado[Op.in], ['programada', 'confirmada']);
  assert.equal(opcionesConsulta.where.fecha[Op.gte], fechaHoyBogota());
  assert.equal(opcionesConsulta.limit, MAX_CITAS);
  assert.deepEqual(opcionesConsulta.order, [
    ['fecha', 'ASC'],
    ['hora', 'ASC']
  ]);
  assert.equal(opcionesConsulta.include[0].as, 'servicio');
});

test('sin paciente no consulta citas', async (t) => {
  let consultas = 0;

  t.mock.method(db.Cita, 'findAll', async () => {
    consultas += 1;
    return [];
  });

  assert.deepEqual(await listarCitasFuturas(null), []);
  assert.equal(consultas, 0);
});

test('cancelar crea una solicitud pendiente sin tocar la cita', async (t) => {
  const cita = crearCita();
  const consultasCita = simularCita(t, cita);
  simularSolicitudAbierta(t, null);
  simularTransaccion(t);
  const creadas = simularCreacion(t);

  const resultado = await crearSolicitudCita({
    conversacion: { id: 10 },
    paciente: { id: 5 },
    citaId: cita.id,
    tipo: 'cancelacion'
  });

  assert.equal(resultado.estado, 'ok');
  assert.equal(resultado.cita, cita);
  assert.equal(consultasCita[0].where.id, 40);
  assert.equal(consultasCita[0].where.pacienteId, 5);
  assert.equal(consultasCita[0].lock, 'UPDATE');
  assert.equal(creadas.length, 1);
  assert.equal(creadas[0].datos.tipo, 'cancelacion');
  assert.equal(creadas[0].datos.estado, 'pendiente');
  assert.equal(creadas[0].datos.origen, 'whatsapp');
  assert.equal(creadas[0].datos.citaId, 40);
  assert.equal(creadas[0].datos.conversacionId, 10);
  assert.equal(creadas[0].datos.fechaPropuesta, null);
  assert.equal(creadas[0].datos.horaPropuesta, null);
  assert.match(creadas[0].datos.mensaje, /cancelación por WhatsApp para la cita #40/);
  assert.equal(creadas[0].opciones.transaction, TRANSACCION);
  assert.equal(cita.estado, 'confirmada');
});

test('reprogramar crea la solicitud con la propuesta del paciente', async (t) => {
  const cita = crearCita();
  const fechaPropuesta = sumarDias(FECHA, 1);

  simularCita(t, cita);
  simularSolicitudAbierta(t, null);
  simularTransaccion(t);
  const creadas = simularCreacion(t);

  const resultado = await crearSolicitudCita({
    conversacion: { id: 10 },
    paciente: { id: 5 },
    citaId: cita.id,
    tipo: 'reprogramacion',
    fechaPropuesta,
    horaPropuesta: '09:30'
  });

  assert.equal(resultado.estado, 'ok');
  assert.equal(creadas[0].datos.tipo, 'reprogramacion');
  assert.equal(creadas[0].datos.fechaPropuesta, fechaPropuesta);
  assert.equal(creadas[0].datos.horaPropuesta, '09:30');
  assert.match(creadas[0].datos.mensaje, /Propuesta del paciente/);
});

test('una propuesta de reprogramación inválida devuelve 400 y no crea nada', async (t) => {
  simularTransaccion(t);
  const creadas = simularCreacion(t);

  await assert.rejects(
    crearSolicitudCita({
      conversacion: { id: 10 },
      paciente: { id: 5 },
      citaId: 40,
      tipo: 'reprogramacion',
      fechaPropuesta: '2026-02-30',
      horaPropuesta: '09:30'
    }),
    (error) => error.statusCode === 400
  );

  assert.equal(creadas.length, 0);
});

test('no duplica una gestión que ya tiene una solicitud abierta', async (t) => {
  const cita = crearCita();
  const abierta = { id: 9, estado: 'pendiente' };

  simularCita(t, cita);
  simularSolicitudAbierta(t, abierta);
  simularTransaccion(t);
  const creadas = simularCreacion(t);

  const resultado = await crearSolicitudCita({
    conversacion: { id: 10 },
    paciente: { id: 5 },
    citaId: cita.id,
    tipo: 'cancelacion'
  });

  assert.equal(resultado.estado, 'duplicada');
  assert.equal(resultado.solicitud, abierta);
  assert.equal(creadas.length, 0);
});

test('una cita inexistente no crea la solicitud', async (t) => {
  simularCita(t, null);
  simularTransaccion(t);
  const creadas = simularCreacion(t);

  const resultado = await crearSolicitudCita({
    conversacion: { id: 10 },
    paciente: { id: 5 },
    citaId: 999,
    tipo: 'cancelacion'
  });

  assert.equal(resultado.estado, 'cita_no_disponible');
  assert.equal(resultado.cita, null);
  assert.equal(creadas.length, 0);
});

for (const estado of ['cancelada', 'atendida', 'no_asistio']) {
  test(`una cita ${estado} no se puede gestionar desde WhatsApp`, async (t) => {
    simularCita(t, crearCita({ estado }));
    simularTransaccion(t);
    const creadas = simularCreacion(t);

    const resultado = await crearSolicitudCita({
      conversacion: { id: 10 },
      paciente: { id: 5 },
      citaId: 40,
      tipo: 'cancelacion'
    });

    assert.equal(resultado.estado, 'cita_no_disponible');
    assert.equal(creadas.length, 0);
  });
}

test('el escalamiento crea una consulta pendiente con el mensaje original', async (t) => {
  simularTransaccion(t);
  simularSolicitudAbierta(t, null);
  const creadas = simularCreacion(t);

  const resultado = await registrarEscalamiento({
    conversacion: { id: 10, pacienteId: 5 },
    paciente: { id: 5 },
    mensaje: '  Necesito cambiar el titular de la cita  '
  });

  assert.equal(resultado.estado, 'creada');
  assert.equal(creadas.length, 1);
  assert.equal(creadas[0].datos.tipo, 'consulta');
  assert.equal(creadas[0].datos.estado, 'pendiente');
  assert.equal(creadas[0].datos.origen, 'whatsapp');
  assert.equal(creadas[0].datos.conversacionId, 10);
  assert.equal(creadas[0].datos.citaId, null);
  assert.equal(creadas[0].datos.mensaje, 'Necesito cambiar el titular de la cita');
});

test('los mensajes seguidos se agrupan en la solicitud abierta de los últimos 10 minutos', async (t) => {
  const abierta = {
    id: 9,
    mensaje: 'Hola, necesito ayuda',
    actualizaciones: [],
    async update(cambios) {
      this.actualizaciones.push(cambios);
      Object.assign(this, cambios);
    }
  };
  const consultas = simularSolicitudAbierta(t, abierta);
  const creadas = simularCreacion(t);

  simularTransaccion(t);

  const resultado = await registrarEscalamiento({
    conversacion: { id: 10, pacienteId: 5 },
    paciente: { id: 5 },
    mensaje: 'Además quiero cambiar mi cita'
  });

  assert.equal(resultado.estado, 'agrupada');
  assert.equal(creadas.length, 0);
  assert.equal(abierta.mensaje, 'Hola, necesito ayuda\n\nAdemás quiero cambiar mi cita');
  assert.equal(abierta.actualizaciones.length, 1);

  const where = consultas[0].where;
  const desde = where.updatedAt[Op.gte];
  const ahora = Date.now();

  assert.deepEqual(where.tipo[Op.in], ['consulta', 'otra']);
  assert.equal(where.estado, 'pendiente');
  assert.equal(where.conversacionId, 10);
  assert.ok(desde instanceof Date);
  assert.ok(ahora - desde.getTime() <= VENTANA_AGRUPACION_MS + 1000);
});

test('un mensaje fuera de los 10 minutos crea otra solicitud', async (t) => {
  simularTransaccion(t);
  simularSolicitudAbierta(t, null);
  const creadas = simularCreacion(t);

  await registrarEscalamiento({
    conversacion: { id: 10, pacienteId: 5 },
    paciente: { id: 5 },
    mensaje: 'Otra consulta nueva'
  });

  assert.equal(creadas.length, 1);
  assert.equal(creadas[0].datos.mensaje, 'Otra consulta nueva');
});

test('un id de botón no se guarda como mensaje del paciente', async (t) => {
  simularTransaccion(t);
  simularSolicitudAbierta(t, null);
  const creadas = simularCreacion(t);

  await registrarEscalamiento({
    conversacion: { id: 10, pacienteId: 5 },
    paciente: { id: 5 },
    mensaje: 'menu:humano'
  });

  assert.equal(
    creadas[0].datos.mensaje,
    'El paciente pidió hablar con una persona.'
  );
});

test('sin conversación ni paciente el escalamiento falla con 400', async (t) => {
  simularTransaccion(t);

  await assert.rejects(
    registrarEscalamiento({ conversacion: null, paciente: null, mensaje: 'Hola' }),
    (error) => error.statusCode === 400
  );
});
