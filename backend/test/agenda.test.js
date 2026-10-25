const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  aMinutos,
  fechaHoyBogota,
  formatearMinutos
} = require('../src/utils/tiempo');
const {
  DURACION_POR_DEFECTO,
  estadoOcupaHorario,
  generarFranjas
} = require('../src/utils/agenda');
const {
  obtenerDiaSemana,
  validarFechaDisponible,
  validarHorarioCita
} = require('../src/services/agendaService');
const db = require('../src/models');

const RANGOS_ENTRE_SEMANA = [
  { inicio: '08:00', fin: '12:00' },
  { inicio: '14:00', fin: '18:00' }
];

const RANGO_SABADO = [{ inicio: '08:00', fin: '12:00' }];

test('convierte y formatea horas correctamente', () => {
  assert.equal(aMinutos('08:00'), 480);
  assert.equal(aMinutos('08:00:00'), 480);
  assert.equal(aMinutos('23:59'), 1439);
  assert.equal(aMinutos('24:00'), null);
  assert.equal(aMinutos('08:60'), null);
  assert.equal(formatearMinutos(480), '08:00');
  assert.equal(formatearMinutos(1439), '23:59');
  assert.equal(formatearMinutos(0), '00:00');
});

test('calcula el día de la semana sin desfase de zona horaria', () => {
  assert.equal(obtenerDiaSemana('2026-10-25'), 0); // domingo
  assert.equal(obtenerDiaSemana('2026-10-26'), 1); // lunes
  assert.equal(obtenerDiaSemana('2026-10-31'), 6); // sábado
});

test('genera bloques de 30 minutos en los dos rangos del día', () => {
  const franjas = generarFranjas({
    rangos: RANGOS_ENTRE_SEMANA,
    duracionMinutos: 30
  });

  assert.deepEqual(franjas, [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ]);
});

test('un servicio de 60 minutos no cruza el almuerzo ni el cierre', () => {
  const franjas = generarFranjas({
    rangos: RANGOS_ENTRE_SEMANA,
    duracionMinutos: 60
  });

  assert.deepEqual(franjas, [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
  ]);
  assert.ok(!franjas.includes('11:30'));
  assert.ok(!franjas.includes('17:30'));
});

test('un servicio de 45 minutos solo ofrece bloques que terminan dentro del rango', () => {
  const franjas = generarFranjas({
    rangos: RANGOS_ENTRE_SEMANA,
    duracionMinutos: 45
  });

  assert.ok(franjas.includes('11:00'));
  assert.ok(!franjas.includes('11:30'));
  assert.ok(franjas.includes('17:00'));
  assert.ok(!franjas.includes('17:30'));

  for (const franja of franjas) {
    const inicio = aMinutos(franja);
    const cabeEnRango = RANGOS_ENTRE_SEMANA.some(({ inicio: rangoInicio, fin: rangoFin }) => {
      return inicio >= aMinutos(rangoInicio) && inicio + 45 <= aMinutos(rangoFin);
    });
    assert.ok(cabeEnRango, `La franja ${franja} no cabe completa en un rango`);
  }
});

test('respeta el tamaño de bloque configurable', () => {
  const franjas = generarFranjas({
    rangos: RANGO_SABADO,
    duracionMinutos: 30,
    slotMinutos: 45
  });

  assert.deepEqual(franjas, ['08:00', '08:45', '09:30', '10:15', '11:00']);
});

test('una cita bloquea los bloques que se cruzan y no los contiguos', () => {
  const franjas = generarFranjas({
    rangos: RANGOS_ENTRE_SEMANA,
    duracionMinutos: 30,
    bloqueos: [{ inicio: aMinutos('10:00'), fin: aMinutos('10:30') }]
  });

  assert.ok(!franjas.includes('10:00'));
  assert.ok(franjas.includes('09:30'));
  assert.ok(franjas.includes('10:30'));
});

test('un día completamente ocupado no ofrece franjas', () => {
  const bloqueos = [
    { inicio: aMinutos('08:00'), fin: aMinutos('12:00') },
    { inicio: aMinutos('14:00'), fin: aMinutos('18:00') }
  ];

  const franjas = generarFranjas({
    rangos: RANGOS_ENTRE_SEMANA,
    duracionMinutos: 30,
    bloqueos
  });

  assert.deepEqual(franjas, []);
});

test('si la fecha es hoy se descartan los bloques cuya hora ya pasó', () => {
  const franjas = generarFranjas({
    rangos: RANGOS_ENTRE_SEMANA,
    duracionMinutos: 30,
    ahora: aMinutos('10:00')
  });

  assert.ok(!franjas.includes('08:00'));
  assert.ok(!franjas.includes('09:30'));
  assert.ok(!franjas.includes('10:00'));
  assert.ok(franjas.includes('10:30'));
});

test('cancelada y no_asistio no ocupan horario', () => {
  assert.equal(estadoOcupaHorario('programada'), true);
  assert.equal(estadoOcupaHorario('confirmada'), true);
  assert.equal(estadoOcupaHorario('atendida'), true);
  assert.equal(estadoOcupaHorario('cancelada'), false);
  assert.equal(estadoOcupaHorario('no_asistio'), false);
});

test('usa 30 minutos como duración por defecto', () => {
  assert.equal(DURACION_POR_DEFECTO, 30);
});

test('valida fechas de disponibilidad contra hoy en Bogotá', () => {
  assert.throws(
    () => validarFechaDisponible('2026-02-30'),
    (error) => error.statusCode === 400
  );

  assert.throws(
    () => validarFechaDisponible('2020-01-01'),
    (error) => error.statusCode === 400
  );

  assert.equal(validarFechaDisponible(fechaHoyBogota()), fechaHoyBogota());
});

const proximoDia = (diaSemana) => {
  const fecha = new Date(`${fechaHoyBogota()}T00:00:00Z`);
  let dias = (diaSemana - fecha.getUTCDay() + 7) % 7;

  if (dias === 0) dias = 7;

  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return fecha.toISOString().slice(0, 10);
};

const simularHorario = (t, horarios) => {
  t.mock.method(db.HorarioAtencion, 'findAll', async () => horarios);
};

test('valida que la cita esté dentro del horario y alineada al bloque', async (t) => {
  const fecha = proximoDia(1); // lunes futuro
  simularHorario(t, [
    { horaInicio: '08:00:00', horaFin: '12:00:00' },
    { horaInicio: '14:00:00', horaFin: '18:00:00' }
  ]);

  const resultado = await validarHorarioCita({ fecha, hora: '10:00', duracionMinutos: 30 });
  assert.equal(resultado.inicio, 600);
  assert.equal(resultado.fin, 630);

  await assert.rejects(
    validarHorarioCita({ fecha, hora: '07:00', duracionMinutos: 30 }),
    (error) => error.statusCode === 400
  );

  await assert.rejects(
    validarHorarioCita({ fecha, hora: '10:15', duracionMinutos: 30 }),
    (error) => error.statusCode === 400 && /alineada/.test(error.message)
  );

  await assert.rejects(
    validarHorarioCita({ fecha, hora: '25:00', duracionMinutos: 30 }),
    (error) => error.statusCode === 400
  );

  await assert.rejects(
    validarHorarioCita({ fecha, hora: '11:30', duracionMinutos: 60 }),
    (error) => error.statusCode === 400 && /no cabe/.test(error.message)
  );

  await assert.rejects(
    validarHorarioCita({ fecha, hora: '13:00', duracionMinutos: 30 }),
    (error) => error.statusCode === 400
  );
});

test('rechaza citas en un día sin horario de atención', async (t) => {
  const fecha = proximoDia(0); // domingo futuro
  simularHorario(t, []);

  await assert.rejects(
    validarHorarioCita({ fecha, hora: '10:00', duracionMinutos: 30 }),
    (error) => error.statusCode === 400 && /no atiende/.test(error.message)
  );
});

test('permite editar una cita histórica sin aplicarle el horario actual', async () => {
  const resultado = await validarHorarioCita({
    fecha: '2020-01-01',
    hora: '20:00',
    duracionMinutos: 30,
    permitirFechaPasada: true
  });

  assert.deepEqual(resultado, { omitido: true });
});
