const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const db = require('../src/models');
const whatsappApi = require('../src/services/whatsappApi');
const { fechaHoyBogota } = require('../src/utils/tiempo');
const { MOTIVO_VENTANA_CERRADA } = require('../src/utils/whatsapp');
const {
  listarSolicitudes,
  obtenerSolicitud,
  cambiarEstadoSolicitud
} = require('../src/services/solicitudService');

const TRANSACCION = { id: 'transaccion-1', LOCK: { UPDATE: 'UPDATE' } };

const HORARIO = [
  { horaInicio: '08:00:00', horaFin: '12:00:00' },
  { horaInicio: '14:00:00', horaFin: '18:00:00' }
];

const SERVICIO = { id: 3, nombre: 'Limpieza', duracionMinutos: 30, precio: 50 };
const PROFESIONAL = { id: 2, nombre: 'Ana', apellido: 'Rojas', especialidad: 'Ortodoncia' };

const proximoDia = (diaSemana) => {
  const fecha = new Date(`${fechaHoyBogota()}T00:00:00Z`);
  let dias = (diaSemana - fecha.getUTCDay() + 7) % 7;

  if (dias === 0) dias = 7;

  fecha.setUTCDate(fecha.getUTCDate() + dias);

  return fecha.toISOString().slice(0, 10);
};

const crearSolicitud = (datos = {}) => ({
  id: 1,
  estado: 'pendiente',
  tipo: 'consulta',
  citaId: null,
  fechaPropuesta: null,
  horaPropuesta: null,
  update: async function actualizar(cambios, opciones) {
    Object.assign(this, cambios);
    this.ultimaActualizacion = opciones;
  },
  ...datos
});

const simularTransaccion = (t) => {
  t.mock.method(db.sequelize, 'transaction', async (callback) => callback(TRANSACCION));
};

const simularHistorial = (t) => {
  const creados = [];

  t.mock.method(db.SolicitudHistorial, 'create', async (datos, opciones) => {
    creados.push({ datos, opciones });
    return { id: creados.length, ...datos };
  });

  return creados;
};

const simularCatalogos = (t) => {
  t.mock.method(db.Servicio, 'findByPk', async () => SERVICIO);
  t.mock.method(db.Profesional, 'findByPk', async () => PROFESIONAL);
  t.mock.method(db.HorarioAtencion, 'findAll', async () => HORARIO);
};

const CASOS_PERMITIDOS = [
  { desde: 'pendiente', hasta: 'en_atencion', comentario: '  En revisión  ', esperado: 'En revisión' },
  { desde: 'pendiente', hasta: 'resuelta', comentario: '  Atendida  ', esperado: 'Atendida' },
  { desde: 'en_atencion', hasta: 'resuelta', comentario: 'Cerrada', esperado: 'Cerrada' }
];

for (const caso of CASOS_PERMITIDOS) {
  test(`permite la transición ${caso.desde} → ${caso.hasta} y deja historial`, async (t) => {
    const solicitud = crearSolicitud({ estado: caso.desde });

    simularTransaccion(t);
    t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
    const historial = simularHistorial(t);

    const resultado = await cambiarEstadoSolicitud(
      solicitud.id,
      { estado: caso.hasta, comentario: caso.comentario },
      { id: 7, rol: 'recepcionista' }
    );

    assert.equal(resultado, solicitud);
    assert.equal(solicitud.estado, caso.hasta);
    assert.equal(solicitud.ultimaActualizacion.transaction, TRANSACCION);
    assert.equal(historial.length, 1);
    assert.deepEqual(historial[0].datos, {
      solicitudId: solicitud.id,
      estadoAnterior: caso.desde,
      estadoNuevo: caso.hasta,
      usuarioId: 7,
      comentario: caso.esperado
    });
    assert.equal(historial[0].opciones.transaction, TRANSACCION);
  });
}

const CASOS_PROHIBIDOS = [
  { desde: 'pendiente', hasta: 'pendiente', nombre: 'mismo estado' },
  { desde: 'resuelta', hasta: 'en_atencion', nombre: 'volver a en atención' },
  { desde: 'resuelta', hasta: 'resuelta', nombre: 'resolver dos veces' },
  { desde: 'pendiente', hasta: 'aprobada', nombre: 'estado inexistente' }
];

for (const caso of CASOS_PROHIBIDOS) {
  test(`rechaza con 409 ${caso.nombre}`, async (t) => {
    const solicitud = crearSolicitud({ estado: caso.desde });
    let actualizaciones = 0;

    solicitud.update = async () => {
      actualizaciones += 1;
    };

    simularTransaccion(t);
    t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
    const historial = simularHistorial(t);

    await assert.rejects(
      cambiarEstadoSolicitud(
        solicitud.id,
        { estado: caso.hasta, comentario: 'Comentario' },
        { id: 7 }
      ),
      (error) => error.statusCode === 409
    );

    assert.equal(actualizaciones, 0);
    assert.equal(historial.length, 0);
  });
}

test('resolver sin comentario devuelve 400 y no cambia nada', async (t) => {
  const solicitud = crearSolicitud();
  let actualizaciones = 0;

  solicitud.update = async () => {
    actualizaciones += 1;
  };

  simularTransaccion(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
  const historial = simularHistorial(t);

  await assert.rejects(
    cambiarEstadoSolicitud(solicitud.id, { estado: 'resuelta' }, { id: 7 }),
    (error) => error.statusCode === 400 && /comentario/.test(error.message)
  );

  assert.equal(actualizaciones, 0);
  assert.equal(historial.length, 0);
});

test('una solicitud inexistente devuelve 404', async (t) => {
  simularTransaccion(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => null);

  await assert.rejects(
    cambiarEstadoSolicitud(99, { estado: 'en_atencion' }, { id: 7 }),
    (error) => error.statusCode === 404
  );
});

test('resolver una cancelación deja la cita cancelada y registra historial', async (t) => {
  const solicitud = crearSolicitud({
    tipo: 'cancelacion',
    citaId: 10
  });
  const cita = {
    id: 10,
    estado: 'programada',
    update: async function actualizar(cambios, opciones) {
      Object.assign(this, cambios);
      this.ultimaActualizacion = opciones;
    }
  };

  simularTransaccion(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
  t.mock.method(db.Cita, 'findByPk', async () => cita);
  const historial = simularHistorial(t);

  await cambiarEstadoSolicitud(
    solicitud.id,
    { estado: 'resuelta', comentario: 'El paciente canceló' },
    { id: 9 }
  );

  assert.equal(cita.estado, 'cancelada');
  assert.equal(cita.ultimaActualizacion.transaction, TRANSACCION);
  assert.equal(solicitud.estado, 'resuelta');
  assert.equal(historial.length, 1);
  assert.equal(historial[0].datos.estadoNuevo, 'resuelta');
});

test('resolver una reprogramación actualiza la cita cuando la franja está libre', async (t) => {
  const fecha = proximoDia(1);
  const solicitud = crearSolicitud({
    tipo: 'reprogramacion',
    citaId: 10,
    fechaPropuesta: fecha,
    horaPropuesta: '11:00'
  });
  const cita = {
    id: 10,
    pacienteId: 1,
    profesionalId: 2,
    servicioId: 3,
    fecha: proximoDia(2),
    hora: '10:00',
    estado: 'programada',
    update: async function actualizar(cambios, opciones) {
      Object.assign(this, cambios);
      this.ultimaActualizacion = opciones;
    }
  };

  simularTransaccion(t);
  simularCatalogos(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
  t.mock.method(db.Cita, 'findByPk', async () => cita);
  t.mock.method(db.Cita, 'findAll', async () => []);
  const historial = simularHistorial(t);

  await cambiarEstadoSolicitud(
    solicitud.id,
    { estado: 'resuelta', comentario: 'Reprogramada por el paciente' },
    { id: 9 }
  );

  assert.equal(cita.fecha, fecha);
  assert.equal(cita.hora, '11:00');
  assert.equal(cita.ultimaActualizacion.transaction, TRANSACCION);
  assert.equal(solicitud.estado, 'resuelta');
  assert.equal(historial.length, 1);
});

test('reprogramar a una franja ocupada devuelve 409 con alternativas y no guarda nada', async (t) => {
  const fecha = proximoDia(1);
  const solicitud = crearSolicitud({
    tipo: 'reprogramacion',
    citaId: 10,
    fechaPropuesta: fecha,
    horaPropuesta: '11:00'
  });
  const conflicto = {
    id: 99,
    pacienteId: 5,
    profesionalId: 2,
    hora: '11:00',
    servicio: { duracionMinutos: 30 }
  };
  let actualizacionesCita = 0;
  let actualizacionesSolicitud = 0;
  let historialCreado = 0;
  const cita = {
    id: 10,
    pacienteId: 1,
    profesionalId: 2,
    servicioId: 3,
    fecha: proximoDia(2),
    hora: '10:00',
    estado: 'programada',
    update: async () => {
      actualizacionesCita += 1;
    }
  };

  solicitud.update = async () => {
    actualizacionesSolicitud += 1;
  };

  simularTransaccion(t);
  simularCatalogos(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
  t.mock.method(db.Cita, 'findByPk', async () => cita);
  t.mock.method(db.Cita, 'findAll', async (opciones = {}) => {
    const where = opciones.where || {};

    if (where.profesionalId && !where.pacienteId) return [conflicto];
    if (where[Op.or]) return [conflicto];
    return [];
  });
  t.mock.method(db.SolicitudHistorial, 'create', async () => {
    historialCreado += 1;
  });

  await assert.rejects(
    cambiarEstadoSolicitud(
      solicitud.id,
      { estado: 'resuelta', comentario: 'Reprogramar' },
      { id: 9 }
    ),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /El profesional ya tiene una cita/);
      assert.ok(Array.isArray(error.alternativas));
      assert.ok(error.alternativas.includes('11:30'));
      assert.ok(!error.alternativas.includes('11:00'));
      return true;
    }
  );

  assert.equal(actualizacionesCita, 0);
  assert.equal(actualizacionesSolicitud, 0);
  assert.equal(historialCreado, 0);
  assert.equal(solicitud.estado, 'pendiente');
});

test('una reprogramación sin fecha u hora propuestas devuelve 400', async (t) => {
  const solicitud = crearSolicitud({
    tipo: 'reprogramacion',
    citaId: 10
  });
  const cita = {
    id: 10,
    pacienteId: 1,
    profesionalId: 2,
    servicioId: 3,
    fecha: proximoDia(2),
    hora: '10:00',
    estado: 'programada',
    update: async () => {
      throw new Error('No debería actualizarse');
    }
  };

  simularTransaccion(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
  t.mock.method(db.Cita, 'findByPk', async () => cita);
  const historial = simularHistorial(t);

  await assert.rejects(
    cambiarEstadoSolicitud(
      solicitud.id,
      { estado: 'resuelta', comentario: 'Reprogramar' },
      { id: 9 }
    ),
    (error) => error.statusCode === 400 && /fecha y hora propuestas/.test(error.message)
  );

  assert.equal(historial.length, 0);
});

test('el detalle incluye paciente, cita e historial ascendente', async (t) => {
  const solicitud = { id: 5, estado: 'pendiente' };
  let opcionesConsulta = null;

  t.mock.method(db.Solicitud, 'findByPk', async (id, opciones) => {
    opcionesConsulta = opciones;
    return solicitud;
  });

  const resultado = await obtenerSolicitud(5);

  assert.equal(resultado, solicitud);
  assert.deepEqual(
    opcionesConsulta.include.map((incluida) => incluida.as),
    ['paciente', 'servicio', 'cita', 'historial']
  );
  assert.deepEqual(opcionesConsulta.order[0], [
    { model: db.SolicitudHistorial, as: 'historial' },
    'createdAt',
    'ASC'
  ]);
});

test('el detalle de una solicitud inexistente devuelve 404', async (t) => {
  t.mock.method(db.Solicitud, 'findByPk', async () => null);

  await assert.rejects(
    obtenerSolicitud(404),
    (error) => error.statusCode === 404
  );
});

test('el listado aplica filtros, paginación y orden descendente por fecha', async (t) => {
  let opcionesConsulta = null;

  t.mock.method(db.Solicitud, 'findAndCountAll', async (opciones) => {
    opcionesConsulta = opciones;
    return { count: 0, rows: [] };
  });

  const resultado = await listarSolicitudes({
    estado: 'pendiente',
    tipo: 'consulta',
    pacienteId: '2',
    fecha: '2026-11-10',
    pagina: '2',
    limite: '5'
  });

  assert.deepEqual(resultado, { datos: [], total: 0, pagina: 2, limite: 5 });
  assert.equal(opcionesConsulta.where.estado, 'pendiente');
  assert.equal(opcionesConsulta.where.tipo, 'consulta');
  assert.equal(opcionesConsulta.where.pacienteId, 2);
  assert.deepEqual(opcionesConsulta.where.fechaSolicitud[Op.between], [
    '2026-11-10 00:00:00',
    '2026-11-10 23:59:59'
  ]);
  assert.deepEqual(opcionesConsulta.order, [
    ['fechaSolicitud', 'DESC'],
    ['id', 'DESC']
  ]);
  assert.equal(opcionesConsulta.offset, 5);
  assert.equal(opcionesConsulta.limit, 5);
  assert.ok(opcionesConsulta.include.some((incluida) => incluida.as === 'paciente'));
});

test('el listado valida estado, tipo, paciente, fecha y paginación', async () => {
  const casos = [
    { filtros: { estado: 'aprobada' }, mensaje: /Estado inválido/ },
    { filtros: { tipo: 'aprobada' }, mensaje: /Tipo inválido/ },
    { filtros: { pacienteId: 'abc' }, mensaje: /pacienteId/ },
    { filtros: { fecha: '2026-02-30' }, mensaje: /fecha/ },
    { filtros: { pagina: '0' }, mensaje: /pagina/ },
    { filtros: { limite: '101' }, mensaje: /limite/ }
  ];

  for (const caso of casos) {
    await assert.rejects(
      listarSolicitudes(caso.filtros),
      (error) => error.statusCode === 400 && caso.mensaje.test(error.message)
    );
  }
});

const crearConversacionWhatsapp = (datos = {}) => ({
  id: 3,
  telefono: '573001234567',
  pacienteId: 1,
  actualizaciones: [],
  async update(cambios) {
    this.actualizaciones.push(cambios);
  },
  ...datos
});

const resolverSolicitudWhatsapp = async (t, solicitud, opciones = {}) => {
  const conversacion = opciones.conversacion ?? crearConversacionWhatsapp();
  const cita = {
    id: 10,
    estado: 'programada',
    fecha: '2026-11-10',
    hora: '09:00:00',
    update: async function actualizar(cambios) {
      Object.assign(this, cambios);
    }
  };
  const mensajesCreados = [];

  solicitud.cita = { fecha: cita.fecha, hora: cita.hora };

  simularTransaccion(t);
  simularCatalogos(t);
  t.mock.method(db.Solicitud, 'findByPk', async () => solicitud);
  t.mock.method(db.Cita, 'findByPk', async () => cita);
  t.mock.method(db.Cita, 'findAll', async () => []);
  t.mock.method(db.Conversacion, 'findByPk', async () =>
    opciones.conversacion === null ? null : conversacion
  );
  t.mock.method(db.Mensaje, 'findOne', async () => ({
    ocurridoEn: opciones.ultimoEntrante ?? new Date()
  }));
  t.mock.method(db.Mensaje, 'create', async (datos) => {
    mensajesCreados.push(datos);
    return { id: mensajesCreados.length, ...datos };
  });
  const envios = [];
  t.mock.method(whatsappApi, 'enviarMensaje', async (telefono, contenido) => {
    envios.push({ telefono, contenido });

    if (opciones.errorEnvio) throw opciones.errorEnvio;

    return { waMessageId: 'wamid-resolucion-1' };
  });
  t.mock.method(db.SolicitudHistorial, 'create', async () => ({ id: 1 }));

  await cambiarEstadoSolicitud(
    solicitud.id,
    { estado: 'resuelta', comentario: 'Atendida por recepción' },
    { id: 9 }
  );

  return { conversacion, cita, mensajesCreados, envios };
};

test('al resolver avisa al paciente por WhatsApp si la ventana está abierta', async (t) => {
  const solicitud = crearSolicitud({
    tipo: 'cancelacion',
    citaId: 10,
    origen: 'whatsapp',
    conversacionId: 3
  });
  const { cita, mensajesCreados, envios, conversacion } = await resolverSolicitudWhatsapp(
    t,
    solicitud
  );

  assert.equal(cita.estado, 'cancelada');
  assert.equal(envios.length, 1);
  assert.equal(envios[0].telefono, '573001234567');
  assert.match(envios[0].contenido, /quedó cancelada/);
  assert.match(envios[0].contenido, /10 de noviembre/);
  assert.equal(mensajesCreados.length, 1);
  assert.equal(mensajesCreados[0].direccion, 'saliente');
  assert.equal(mensajesCreados[0].estado, 'enviado');
  assert.equal(mensajesCreados[0].conversacionId, 3);
  assert.equal(conversacion.actualizaciones.length, 1);
});

test('con la ventana cerrada deja la constancia y no llama a Meta', async (t) => {
  const solicitud = crearSolicitud({
    tipo: 'reprogramacion',
    citaId: 10,
    origen: 'whatsapp',
    conversacionId: 3,
    fechaPropuesta: '2026-11-12',
    horaPropuesta: '11:00'
  });
  const { mensajesCreados, envios } = await resolverSolicitudWhatsapp(t, solicitud, {
    ultimoEntrante: new Date(Date.now() - 25 * 60 * 60 * 1000)
  });

  assert.equal(envios.length, 0);
  assert.equal(mensajesCreados.length, 1);
  assert.equal(mensajesCreados[0].estado, 'fallido');
  assert.equal(mensajesCreados[0].motivoFallo, MOTIVO_VENTANA_CERRADA);
  assert.equal(mensajesCreados[0].requierePlantilla, true);
  assert.equal(solicitud.estado, 'resuelta');
});

test('un fallo al enviar el aviso no revierte la resolución', async (t) => {
  const solicitud = crearSolicitud({
    tipo: 'cancelacion',
    citaId: 10,
    origen: 'whatsapp',
    conversacionId: 3
  });
  const error = Object.assign(new Error('La API de WhatsApp respondió 500'), { status: 500 });
  const { cita, mensajesCreados } = await resolverSolicitudWhatsapp(t, solicitud, {
    errorEnvio: error
  });

  assert.equal(solicitud.estado, 'resuelta');
  assert.equal(cita.estado, 'cancelada');
  assert.equal(mensajesCreados.length, 1);
  assert.equal(mensajesCreados[0].estado, 'fallido');
  assert.match(mensajesCreados[0].motivoFallo, /respondió 500/);
});

test('sin conversación asociada resuelve y no intenta enviar', async (t) => {
  const solicitud = crearSolicitud({
    tipo: 'cancelacion',
    citaId: 10,
    origen: 'whatsapp',
    conversacionId: 3
  });
  const { mensajesCreados, envios } = await resolverSolicitudWhatsapp(t, solicitud, {
    conversacion: null
  });

  assert.equal(solicitud.estado, 'resuelta');
  assert.equal(envios.length, 0);
  assert.equal(mensajesCreados.length, 0);
});
