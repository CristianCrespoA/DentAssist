const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/models');
const { fechaHoyBogota } = require('../src/utils/tiempo');
const {
  crearCita,
  actualizarCita,
  eliminarCita
} = require('../src/services/citaService');
const { obtenerDisponibilidad } = require('../src/services/disponibilidadService');

const DATOS_CITA = {
  pacienteId: 1,
  profesionalId: 2,
  servicioId: 3,
  fecha: '',
  hora: '10:00',
  estado: 'programada',
  observaciones: 'Primera visita'
};

const PACIENTE = { id: 1, nombre: 'Laura', apellido: 'Gómez', telefono: '573001112233' };
const PROFESIONAL = { id: 2, nombre: 'Ana', apellido: 'Rojas', especialidad: 'Ortodoncia' };
const SERVICIO = {
  id: 3,
  nombre: 'Limpieza Dental',
  duracionMinutos: 30,
  precio: 50
};

const HORARIO = [
  { horaInicio: '08:00:00', horaFin: '12:00:00' },
  { horaInicio: '14:00:00', horaFin: '18:00:00' }
];

const proximoDia = (diaSemana) => {
  const fecha = new Date(`${fechaHoyBogota()}T00:00:00Z`);
  let dias = (diaSemana - fecha.getUTCDay() + 7) % 7;

  if (dias === 0) dias = 7;

  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return fecha.toISOString().slice(0, 10);
};

const simularCatalogos = (t) => {
  t.mock.method(db.Paciente, 'findByPk', async () => PACIENTE);
  t.mock.method(db.Profesional, 'findByPk', async () => PROFESIONAL);
  t.mock.method(db.Servicio, 'findByPk', async () => SERVICIO);
  t.mock.method(db.HorarioAtencion, 'findAll', async () => HORARIO);
};

const citaConRelaciones = (cita) => ({
  ...cita,
  paciente: PACIENTE,
  profesional: PROFESIONAL,
  servicio: SERVICIO
});

test('crea una cita cuando la franja está libre', async (t) => {
  const fecha = proximoDia(1);
  simularCatalogos(t);
  t.mock.method(db.Cita, 'findAll', async () => []);

  let creada = null;
  t.mock.method(db.Cita, 'create', async (datos) => {
    creada = { id: 42, ...datos };
    return creada;
  });
  t.mock.method(db.Cita, 'findByPk', async () => citaConRelaciones(creada));

  const cita = await crearCita({ ...DATOS_CITA, fecha });

  assert.equal(cita.id, 42);
  assert.equal(creada.pacienteId, 1);
  assert.equal(creada.profesionalId, 2);
  assert.equal(creada.servicioId, 3);
  assert.equal(creada.estado, 'programada');
});

test('crear una cita devuelve 409 con el rango ocupado cuando hay cruce', async (t) => {
  const fecha = proximoDia(1);
  simularCatalogos(t);
  t.mock.method(db.Cita, 'findAll', async () => [
    {
      id: 9,
      pacienteId: 5,
      profesionalId: 2,
      hora: '10:00',
      servicio: { duracionMinutos: 30 }
    }
  ]);
  const crearMock = t.mock.method(db.Cita, 'create', async () => ({ id: 99 }));

  await assert.rejects(
    crearCita({ ...DATOS_CITA, fecha }),
    (error) =>
      error.statusCode === 409 &&
      /El profesional ya tiene una cita/.test(error.message) &&
      /de 10:00 a 10:30/.test(error.message)
  );

  assert.equal(crearMock.mock.callCount(), 0);
});

test('actualiza una cita cuando la nueva franja está libre', async (t) => {
  const fecha = proximoDia(1);
  simularCatalogos(t);
  t.mock.method(db.Cita, 'findAll', async () => []);

  let actualizaciones = 0;
  const cita = {
    id: 7,
    pacienteId: 1,
    profesionalId: 2,
    servicioId: 3,
    fecha,
    hora: '10:00',
    estado: 'programada',
    observaciones: null,
    update: async function actualizar(datos) {
      actualizaciones += 1;
      Object.assign(this, datos);
    }
  };

  t.mock.method(db.Cita, 'findByPk', async (id, opciones) =>
    opciones?.include ? citaConRelaciones(cita) : cita
  );

  const resultado = await actualizarCita(7, {
    hora: '11:00',
    observaciones: 'Reprogramada'
  });

  assert.equal(actualizaciones, 1);
  assert.equal(resultado.hora, '11:00');
  assert.equal(resultado.observaciones, 'Reprogramada');
});

test('editar una cita devuelve 409 y no guarda cuando la nueva franja se cruza', async (t) => {
  const fecha = proximoDia(1);
  simularCatalogos(t);
  t.mock.method(db.Cita, 'findAll', async () => [
    {
      id: 8,
      pacienteId: 5,
      profesionalId: 2,
      hora: '11:00',
      servicio: { duracionMinutos: 30 }
    }
  ]);

  let actualizaciones = 0;
  const cita = {
    id: 7,
    pacienteId: 1,
    profesionalId: 2,
    servicioId: 3,
    fecha,
    hora: '10:00',
    estado: 'programada',
    observaciones: null,
    update: async () => {
      actualizaciones += 1;
    }
  };

  t.mock.method(db.Cita, 'findByPk', async () => cita);

  await assert.rejects(
    actualizarCita(7, { hora: '11:00' }),
    (error) =>
      error.statusCode === 409 &&
      /El profesional ya tiene una cita/.test(error.message) &&
      /de 11:00 a 11:30/.test(error.message)
  );

  assert.equal(actualizaciones, 0);
});

test('un día cerrado devuelve disponibilidad vacía sin consultar citas', async (t) => {
  const fecha = proximoDia(0); // domingo
  t.mock.method(db.Profesional, 'findByPk', async () => PROFESIONAL);
  t.mock.method(db.Servicio, 'findByPk', async () => SERVICIO);
  t.mock.method(db.HorarioAtencion, 'findAll', async () => []);
  const citasMock = t.mock.method(db.Cita, 'findAll', async () => []);

  const disponibilidad = await obtenerDisponibilidad({
    fecha,
    profesionalId: 2,
    servicioId: 3
  });

  assert.deepEqual(disponibilidad, {
    fecha,
    cerrado: true,
    horario: [],
    duracionMinutos: 30,
    franjas: []
  });
  assert.equal(citasMock.mock.callCount(), 0);
});

test('un día con agenda llena devuelve disponibilidad sin franjas', async (t) => {
  const fecha = proximoDia(1);
  t.mock.method(db.Profesional, 'findByPk', async () => PROFESIONAL);
  t.mock.method(db.Servicio, 'findByPk', async () => SERVICIO);
  t.mock.method(db.HorarioAtencion, 'findAll', async () => HORARIO);
  t.mock.method(db.Cita, 'findAll', async () => [
    { hora: '08:00', servicio: { duracionMinutos: 240 } },
    { hora: '14:00', servicio: { duracionMinutos: 240 } }
  ]);

  const disponibilidad = await obtenerDisponibilidad({
    fecha,
    profesionalId: 2,
    servicioId: 3
  });

  assert.equal(disponibilidad.cerrado, false);
  assert.deepEqual(disponibilidad.franjas, []);
});

test('elimina una cita cancelada', async (t) => {
  let destruida = false;
  const cita = {
    id: 15,
    estado: 'cancelada',
    destroy: async () => {
      destruida = true;
    }
  };

  t.mock.method(db.Cita, 'findByPk', async () => cita);

  const eliminada = await eliminarCita(15);

  assert.equal(eliminada, cita);
  assert.equal(destruida, true);
});

test('rechaza con 409 la eliminación de una cita programada', async (t) => {
  let destruida = false;
  const cita = {
    id: 16,
    estado: 'programada',
    destroy: async () => {
      destruida = true;
    }
  };

  t.mock.method(db.Cita, 'findByPk', async () => cita);

  await assert.rejects(
    eliminarCita(16),
    (error) =>
      error.statusCode === 409 &&
      error.message === 'Solo se pueden eliminar citas canceladas'
  );

  assert.equal(destruida, false);
});

test('eliminar una cita inexistente devuelve 404', async (t) => {
  t.mock.method(db.Cita, 'findByPk', async () => null);

  await assert.rejects(eliminarCita(404), (error) => error.statusCode === 404);
});
