'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/models');
const citaService = require('../src/services/citaService');
const whatsappFlujo = require('../src/services/whatsappFlujo');
const { fechaHoyBogota, esFechaValida } = require('../src/utils/tiempo');
const { MENSAJE_HUMANO, parsearContextoJson } = require('../src/utils/whatsapp');

const PACIENTE = { id: 5, nombre: 'Ana', apellido: 'Pérez' };

const crearConversacion = (datos = {}) => ({
  id: 10,
  telefono: '573001234567',
  pacienteId: PACIENTE.id,
  estadoFlujo: 'menu',
  contexto: {},
  actualizaciones: [],
  async update(cambios) {
    if ('estadoFlujo' in cambios) this.estadoFlujo = cambios.estadoFlujo;
    if ('contexto' in cambios) this.contexto = cambios.contexto;

    this.actualizaciones.push(cambios);
  },
  ...datos
});

const diaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

const sumarDias = (fecha, dias) => whatsappFlujo.sumarDias(fecha, dias);

const interactivoDe = (salida) => {
  assert.equal(salida.contenido?.tipo, 'interactivo');

  return salida.contenido.interactivo;
};

const botonesDe = (salida) =>
  interactivoDe(salida).action.buttons.map((boton) => boton.reply);

const filasDe = (salida) => interactivoDe(salida).action.sections[0].rows;

const opcionesDe = (salida) => salida.contenido?.tipo === 'interactivo'
  ? botonesDe(salida)
  : [];

/**
 * Catálogo simulado. `horarios` se devuelve para cualquier día salvo los que
 * estén en `cerrados`; `citas` se filtra por fecha como haría la consulta real.
 */
const crearCatalogo = (t, opciones = {}) => {
  const estado = {
    servicios: opciones.servicios ?? [
      {
        id: 1,
        nombre: 'Limpieza dental',
        duracionMinutos: 30,
        precio: 120000,
        activo: true
      }
    ],
    profesionales: opciones.profesionales ?? [
      {
        id: 7,
        nombre: 'Laura',
        apellido: 'Gómez',
        especialidad: 'Odontología general',
        activo: true
      }
    ],
    horarios: opciones.horarios ?? [
      { diaSemana: 1, horaInicio: '08:00:00', horaFin: '12:00:00', activo: true }
    ],
    cerrados: opciones.cerrados ?? [],
    citas: opciones.citas ?? [],
    llamadasCrearCita: [],
    crearCita:
      opciones.crearCita ??
      (async (datos) => ({
        id: 55,
        ...datos,
        servicio: { nombre: estado.servicios[0]?.nombre ?? 'Servicio' },
        profesional: {
          nombre: estado.profesionales[0]?.nombre ?? '',
          apellido: estado.profesionales[0]?.apellido ?? ''
        }
      }))
  };

  t.mock.method(db.Servicio, 'findAll', async () => estado.servicios);
  t.mock.method(db.Profesional, 'findAll', async () => estado.profesionales);
  t.mock.method(db.HorarioAtencion, 'findAll', async ({ where } = {}) => {
    if (where?.diaSemana !== undefined && estado.cerrados.includes(Number(where.diaSemana))) {
      return [];
    }

    return estado.horarios;
  });
  t.mock.method(db.Cita, 'findAll', async ({ where } = {}) =>
    where?.fecha ? estado.citas.filter((cita) => cita.fecha === where.fecha) : estado.citas
  );
  t.mock.method(citaService, 'crearCita', async (datos) => {
    estado.llamadasCrearCita.push(datos);

    return estado.crearCita(datos);
  });

  return estado;
};

const enviar = (conversacion, contenido = null, seleccion = null) =>
  whatsappFlujo.procesar({
    conversacion,
    paciente: PACIENTE,
    mensaje: { contenido },
    seleccion
  });

const contextoDeReserva = (fecha, extra = {}) => ({
  servicioId: 1,
  servicioNombre: 'Limpieza dental',
  duracionMinutos: 30,
  profesionalId: 7,
  profesionalNombre: 'Laura Gómez',
  fecha,
  ...extra
});

test('transcripción: el camino feliz agenda la cita y vuelve al menú', async (t) => {
  const catalogo = crearCatalogo(t);
  const conversacion = crearConversacion();

  // Menú -> servicio.
  let salidas = await enviar(conversacion, null, { id: 'menu:solicitar' });

  assert.equal(conversacion.estadoFlujo, 'solicitar_servicio');
  assert.equal(salidas.length, 1);
  assert.equal(filasDe(salidas[0]).length, 1);
  assert.equal(filasDe(salidas[0])[0].id, 'serv:1');
  assert.match(filasDe(salidas[0])[0].description, /30 min/);
  assert.match(filasDe(salidas[0])[0].description, /120/);

  // Servicio -> profesional.
  salidas = await enviar(conversacion, null, { id: 'serv:1' });

  assert.equal(conversacion.estadoFlujo, 'solicitar_profesional');
  const profesionales = filasDe(salidas[0]);

  assert.deepEqual(
    profesionales.map((fila) => fila.id),
    ['prof:7', 'prof:cualquiera']
  );

  // Profesional -> fecha.
  salidas = await enviar(conversacion, null, { id: 'prof:7' });

  assert.equal(conversacion.estadoFlujo, 'solicitar_fecha');
  const fechas = botonesDe(salidas[0]);

  assert.ok(fechas.length > 0 && fechas.length <= 3);
  assert.ok(fechas.every((boton) => boton.id.startsWith('fecha:')));

  const fecha = fechas[0].id.slice('fecha:'.length);

  assert.equal(esFechaValida(fecha), true);

  // Fecha -> franjas.
  salidas = await enviar(conversacion, null, { id: `fecha:${fecha}` });

  assert.equal(conversacion.estadoFlujo, 'solicitar_hora');
  const filasHora = filasDe(salidas[0]);
  const horas = filasHora.filter((fila) => fila.id.startsWith('hora:') && fila.id !== 'hora:otro');

  assert.equal(horas.length, 8, 'debe ofrecer como máximo 8 franjas');
  assert.equal(filasHora.at(-1).id, 'hora:otro');

  const hora = horas[0].id.slice('hora:'.length);

  assert.match(hora, /^\d{2}:\d{2}$/);

  // Franja -> resumen.
  salidas = await enviar(conversacion, null, { id: `hora:${hora}` });

  assert.equal(conversacion.estadoFlujo, 'confirmar');
  assert.match(salidas[0].textoPlano, /Confirma tu cita/);
  assert.match(
    salidas[0].contenido.interactivo.body.text,
    /Confirma tu cita\*\n\n• Servicio: Limpieza dental/
  );
  assert.match(salidas[0].textoPlano, /Limpieza dental/);
  assert.match(salidas[0].textoPlano, /Laura Gómez/);
  assert.match(salidas[0].textoPlano, new RegExp(hora));
  assert.deepEqual(
    botonesDe(salidas[0]).map((boton) => boton.id),
    ['confirmar:si', 'confirmar:no']
  );

  // Confirmación -> cita creada.
  salidas = await enviar(conversacion, null, { id: 'confirmar:si' });

  assert.equal(conversacion.estadoFlujo, 'menu');
  assert.equal(catalogo.llamadasCrearCita.length, 1);
  assert.deepEqual(catalogo.llamadasCrearCita[0], {
    pacienteId: PACIENTE.id,
    profesionalId: 7,
    servicioId: 1,
    fecha,
    hora,
    estado: 'programada',
    observaciones: 'Reservada por el asistente de WhatsApp'
  });
  assert.match(salidas[0].textoPlano, /Cita agendada/);
  assert.match(salidas[0].textoPlano, /Cita #55/);
  assert.match(salidas[0].textoPlano, /Limpieza dental/);
  assert.match(salidas[0].textoPlano, /Laura Gómez/);
  assert.equal(conversacion.contexto.ultimaCita.id, 55);
  assert.equal(conversacion.contexto.ultimaConfirmacion.citaId, 55);
});

test('transcripción: una doble confirmación no crea dos citas', async (t) => {
  const catalogo = crearCatalogo(t);
  const fecha = sumarDias(fechaHoyBogota(), 3);
  const conversacion = crearConversacion({
    estadoFlujo: 'confirmar',
    contexto: contextoDeReserva(fecha, { hora: '08:00' })
  });

  let salidas = await enviar(conversacion, 'si', { id: 'confirmar:si' });

  assert.equal(catalogo.llamadasCrearCita.length, 1);
  assert.match(salidas[0].textoPlano, /Cita agendada/);

  // El estado ya volvió al menú: una segunda pulsación no agenda nada.
  salidas = await enviar(conversacion, null, { id: 'confirmar:si' });

  assert.equal(catalogo.llamadasCrearCita.length, 1);
  assert.equal(conversacion.estadoFlujo, 'menu');
  assert.match(salidas[0].textoPlano, /Qué necesitas hacer/);

  // Defensa extra: si el estado todavía dijera `confirmar`, la huella del
  // último intento evita repetir la cita.
  conversacion.estadoFlujo = 'confirmar';
  salidas = await enviar(conversacion, 'si', { id: 'confirmar:si' });

  assert.equal(catalogo.llamadasCrearCita.length, 1);
  assert.match(salidas[0].textoPlano, /ya quedó agendada/);
  assert.equal(conversacion.estadoFlujo, 'menu');
});

test('transcripción: sin cupos ese día sugiere los siguientes días con cupo', async (t) => {
  const fecha = sumarDias(fechaHoyBogota(), 3);
  const catalogo = crearCatalogo(t, { cerrados: [diaSemana(fecha)] });
  const conversacion = crearConversacion({
    estadoFlujo: 'solicitar_fecha',
    contexto: contextoDeReserva(null)
  });

  const salidas = await enviar(conversacion, fecha);

  assert.equal(conversacion.estadoFlujo, 'solicitar_fecha');
  assert.match(salidas[0].textoPlano, /No hay cupos/);
  const dias = botonesDe(salidas[0]);

  assert.equal(dias.length, 3);
  assert.ok(dias.every((boton) => boton.id.startsWith('fecha:')));
  assert.ok(dias.every((boton) => boton.id.slice('fecha:'.length) > fecha));

  // Elegir uno de los días sugeridos continúa el flujo normalmente.
  const elegido = dias[0].id.slice('fecha:'.length);
  const siguiente = await enviar(conversacion, null, { id: dias[0].id });

  assert.equal(conversacion.estadoFlujo, 'solicitar_hora');
  assert.equal(conversacion.contexto.fecha, elegido);
  assert.ok(filasDe(siguiente[0]).length > 1);
});

test('transcripción: disponibilidad muestra hasta 8 franjas y vuelve al menú', async (t) => {
  crearCatalogo(t);
  const conversacion = crearConversacion({
    estadoFlujo: 'disponibilidad',
    contexto: contextoDeReserva(null, { modo: 'disponibilidad' })
  });

  // Atajo de texto para pedir los próximos días con cupo.
  let salidas = await enviar(conversacion, 'próximos días');

  assert.equal(conversacion.estadoFlujo, 'disponibilidad');
  const dias = botonesDe(salidas[0]);

  assert.equal(dias.length, 3);

  salidas = await enviar(conversacion, null, { id: dias[0].id });

  assert.equal(conversacion.estadoFlujo, 'menu');
  assert.equal(salidas.length, 2);

  const franjas = salidas[0].textoPlano.match(/• \d{2}:\d{2}/g) ?? [];

  assert.equal(franjas.length, 8);
  assert.match(salidas[0].textoPlano, /Cupos para el/);
  assert.match(salidas[0].textoPlano, /Limpieza dental/);
  assert.deepEqual(
    botonesDe(salidas[1]).map((boton) => boton.id),
    ['menu:solicitar', 'menu:volver']
  );
});

test('transcripción: una opción inválida repite el paso sin perder el estado', async (t) => {
  crearCatalogo(t);

  const servicioConversacion = crearConversacion({
    estadoFlujo: 'solicitar_servicio',
    contexto: { opciones: ['serv:1'] }
  });
  let salidas = await enviar(servicioConversacion, 'no sé qué poner');

  assert.equal(servicioConversacion.estadoFlujo, 'solicitar_servicio');
  assert.match(salidas[0].textoPlano, /No entendí esa opción/);
  assert.equal(filasDe(salidas[0])[0].id, 'serv:1');

  const menuConversacion = crearConversacion({ estadoFlujo: 'menu' });
  salidas = await enviar(menuConversacion, 'xyz');

  assert.equal(menuConversacion.estadoFlujo, 'menu');
  assert.match(salidas[0].textoPlano, /No entendí esa opción/);
  assert.equal(filasDe(salidas[0]).length, 6);

  const confirmarConversacion = crearConversacion({
    estadoFlujo: 'confirmar',
    contexto: contextoDeReserva(sumarDias(fechaHoyBogota(), 3), { hora: '09:00' })
  });
  salidas = await enviar(confirmarConversacion, 'quizás');

  assert.equal(confirmarConversacion.estadoFlujo, 'confirmar');
  assert.match(salidas[0].textoPlano, /No entendí tu respuesta/);
});

test('transcripción: reiniciar el backend a mitad del flujo conserva el paso', async (t) => {
  crearCatalogo(t);
  const conversacion = crearConversacion();

  await enviar(conversacion, null, { id: 'menu:solicitar' });
  await enviar(conversacion, null, { id: 'serv:1' });

  assert.equal(conversacion.estadoFlujo, 'solicitar_profesional');
  assert.equal(conversacion.contexto.servicioId, 1);

  // Lo único que sobrevive a un reinicio es lo persistido en la base.
  const persistido = JSON.parse(
    JSON.stringify({
      estadoFlujo: conversacion.estadoFlujo,
      contexto: conversacion.contexto
    })
  );
  const reiniciada = crearConversacion(persistido);

  const salidas = await enviar(reiniciada, null, { id: 'prof:cualquiera' });

  assert.equal(reiniciada.estadoFlujo, 'solicitar_fecha');
  assert.equal(reiniciada.contexto.servicioId, 1);
  assert.equal(reiniciada.contexto.servicioNombre, 'Limpieza dental');
  assert.equal(reiniciada.contexto.profesionalId, null);
  assert.match(salidas[0].textoPlano, /Cualquiera disponible/);
});

test('transcripción: si la franja se ocupó al confirmar, ofrece alternativas', async (t) => {
  const fecha = sumarDias(fechaHoyBogota(), 3);
  const catalogo = crearCatalogo(t, {
    crearCita: async () => {
      const error = new Error('El profesional ya tiene una cita en ese horario');
      error.statusCode = 409;

      throw error;
    }
  });
  const conversacion = crearConversacion({
    estadoFlujo: 'confirmar',
    contexto: contextoDeReserva(fecha, { hora: '08:00' })
  });

  const salidas = await enviar(conversacion, 'sí', { id: 'confirmar:si' });

  assert.equal(catalogo.llamadasCrearCita.length, 1);
  assert.equal(conversacion.estadoFlujo, 'solicitar_hora');
  assert.match(salidas[0].textoPlano, /se acaba de ocupar/);
  assert.ok(filasDe(salidas[0]).some((fila) => fila.id === 'hora:otro'));
  assert.equal(conversacion.contexto.hora, null);
});

test('transcripción: si al confirmar ya no quedan cupos, ofrece otros días', async (t) => {
  const fecha = sumarDias(fechaHoyBogota(), 3);
  const catalogo = crearCatalogo(t, {
    cerrados: [diaSemana(fecha)],
    crearCita: async () => {
      const error = new Error('El profesional ya tiene una cita en ese horario');
      error.statusCode = 409;

      throw error;
    }
  });
  const conversacion = crearConversacion({
    estadoFlujo: 'confirmar',
    contexto: contextoDeReserva(fecha, { hora: '08:00' })
  });

  const salidas = await enviar(conversacion, 'sí', { id: 'confirmar:si' });

  assert.equal(catalogo.llamadasCrearCita.length, 1);
  assert.equal(conversacion.estadoFlujo, 'solicitar_fecha');
  assert.match(salidas[0].textoPlano, /ya no quedan cupos/);
  assert.equal(botonesDe(salidas[0]).length, 3);
});

test('transcripción: los atajos de texto funcionan en cualquier paso', async (t) => {
  crearCatalogo(t);

  const menu = crearConversacion({ estadoFlujo: 'menu' });
  let salidas = await enviar(menu, 'hola');

  assert.equal(menu.estadoFlujo, 'menu');
  assert.match(salidas[0].textoPlano, /Qué necesitas hacer/);

  const reservando = crearConversacion({
    estadoFlujo: 'solicitar_fecha',
    contexto: contextoDeReserva(null)
  });
  salidas = await enviar(reservando, 'menú');

  assert.equal(reservando.estadoFlujo, 'menu');
  assert.match(salidas[0].textoPlano, /Qué necesitas hacer/);

  const cancelando = crearConversacion({
    estadoFlujo: 'solicitar_hora',
    contexto: contextoDeReserva(sumarDias(fechaHoyBogota(), 3))
  });
  salidas = await enviar(cancelando, 'cancelar');

  assert.equal(cancelando.estadoFlujo, 'menu');
  assert.match(salidas[0].textoPlano, /cancelé el proceso/);

  const humano = crearConversacion({
    estadoFlujo: 'solicitar_servicio',
    contexto: contextoDeReserva(null)
  });
  salidas = await enviar(humano, 'persona');

  assert.equal(humano.estadoFlujo, 'humano');
  assert.equal(salidas[0].textoPlano, MENSAJE_HUMANO);
});

test('transcripción: servicios y horarios muestra catálogo, duración, precio y atención', async (t) => {
  crearCatalogo(t, {
    servicios: [
      { id: 1, nombre: 'Limpieza dental', duracionMinutos: 30, precio: 120000, activo: true },
      { id: 2, nombre: 'Ortodoncia', duracionMinutos: 45, precio: 250000, activo: true }
    ],
    horarios: [
      { diaSemana: 1, horaInicio: '08:00:00', horaFin: '12:00:00', activo: true },
      { diaSemana: 1, horaInicio: '14:00:00', horaFin: '18:00:00', activo: true }
    ]
  });
  const conversacion = crearConversacion();

  const salidas = await enviar(conversacion, null, { id: 'menu:servicios' });

  assert.equal(conversacion.estadoFlujo, 'info_servicios');
  assert.match(salidas[0].textoPlano, /Servicios y precios/);
  assert.match(salidas[0].textoPlano, /Limpieza dental/);
  assert.match(salidas[0].textoPlano, /30 min/);
  assert.match(salidas[0].textoPlano, /Ortodoncia/);
  assert.match(salidas[0].textoPlano, /45 min/);
  assert.match(salidas[0].textoPlano, /Horario de atención/);
  assert.match(salidas[0].textoPlano, /Lunes: 08:00 a 12:00, 14:00 a 18:00/);
});

test('respeta los límites de WhatsApp en listas y botones', async (t) => {
  crearCatalogo(t, {
    servicios: Array.from({ length: 15 }, (_, indice) => ({
      id: indice + 1,
      nombre: `Servicio ${indice + 1}`,
      duracionMinutos: 30,
      precio: 1000 * (indice + 1),
      activo: true
    })),
    profesionales: Array.from({ length: 9 }, (_, indice) => ({
      id: indice + 1,
      nombre: `Profesional ${indice + 1}`,
      apellido: 'Apellido',
      activo: true
    }))
  });
  const conversacion = crearConversacion();

  let salidas = await enviar(conversacion, null, { id: 'menu:solicitar' });

  assert.ok(filasDe(salidas[0]).length <= 10);

  salidas = await enviar(conversacion, null, { id: 'serv:1' });

  const filas = filasDe(salidas[0]);

  assert.equal(filas.length, 10);
  assert.equal(filas.at(-1).id, 'prof:cualquiera');
});

test('el estado humano no responde automáticamente', async (t) => {
  crearCatalogo(t);
  const conversacion = crearConversacion({ estadoFlujo: 'humano' });

  let salidas = await enviar(conversacion, 'hola');

  assert.deepEqual(salidas, []);
  assert.equal(conversacion.estadoFlujo, 'humano');

  salidas = await enviar(conversacion, 'menú');

  assert.equal(conversacion.estadoFlujo, 'menu');
  assert.match(salidas[0].textoPlano, /Qué necesitas hacer/);
});
