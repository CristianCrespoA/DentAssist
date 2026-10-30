'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const citaService = require('./citaService');
const solicitudWhatsappService = require('./solicitudWhatsappService');
const { obtenerDiaSemana, obtenerRangosDelDia } = require('./agendaService');
const { DURACION_POR_DEFECTO, ESTADOS_SIN_OCUPAR, generarFranjas } = require('../utils/agenda');
const { registrarError } = require('../utils/registroWhatsapp');
const {
  aMinutos,
  esFechaValida,
  fechaHoyBogota,
  formatearMinutos,
  horaActualBogota
} = require('../utils/tiempo');
const {
  ESTADOS_FLUJO,
  MENSAJE_CANCELACION_PENDIENTE,
  MENSAJE_CITA_NO_DISPONIBLE,
  MENSAJE_HUMANO,
  MENSAJE_REPROGRAMACION_PENDIENTE,
  MENSAJE_SIN_CITAS,
  MENSAJE_SOLICITUD_ABIERTA
} = require('../utils/whatsapp');
const {
  botones,
  formatearFecha,
  formatearFechaCorta,
  formatearPrecio,
  lista,
  texto
} = require('../utils/whatsappInteractivo');

const MAX_SERVICIOS = 10;
const MAX_PROFESIONALES = 9;
const MAX_FRANJAS = 8;
const DIAS_SUGERIDOS = 3;
const DIAS_BUSQUEDA = 21;
const DIAS_LIMITE = 90;
// Dos confirmaciones del mismo cupo dentro de esta ventana no crean otra cita.
const VIGENCIA_CONFIRMACION_MS = 5 * 60 * 1000;

const FILAS_MENU = [
  {
    id: 'menu:servicios',
    titulo: 'Servicios y horarios',
    descripcion: 'Precios, duración y horario'
  },
  {
    id: 'menu:disponibilidad',
    titulo: 'Disponibilidad',
    descripcion: 'Consulta cupos por día'
  },
  {
    id: 'menu:solicitar',
    titulo: 'Solicitar cita',
    descripcion: 'Agenda en pocos pasos'
  },
  {
    id: 'menu:cancelar',
    titulo: 'Cancelar cita',
    descripcion: 'Elige la cita a cancelar'
  },
  {
    id: 'menu:reprogramar',
    titulo: 'Reprogramar',
    descripcion: 'Propón una nueva fecha'
  },
  {
    id: 'menu:crear_solicitud',
    titulo: 'Crear solicitud',
    descripcion: 'Enviar una consulta o solicitud'
  },
  {
    id: 'menu:actualizar_datos',
    titulo: 'Actualizar mis datos',
    descripcion: 'Actualiza tu información'
  }
];

// Al volver al menú se descarta la reserva en curso, pero se conservan
// `ultimaCita` y `ultimaConfirmacion` como protección contra dobles envíos.
const LIMPIAR_RESERVA = {
  modo: null,
  servicioId: null,
  servicioNombre: null,
  duracionMinutos: null,
  profesionalId: null,
  profesionalNombre: null,
  fecha: null,
  hora: null,
  franjasOfertadas: null,
  opciones: null,
  diasOfrecidos: null,
  citaId: null,
  citaOriginal: null
};

const leerContexto = (conversacion) => {
  const valor = conversacion?.contexto;

  return valor && typeof valor === 'object' && !Array.isArray(valor) ? { ...valor } : {};
};

const guardar = async (conversacion, estadoFlujo, cambios = {}) => {
  const contexto = { ...leerContexto(conversacion), ...cambios };

  await conversacion.update({ estadoFlujo, contexto });

  return contexto;
};

const normalizar = (valor) => {
  if (typeof valor !== 'string') return '';

  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const idDe = (seleccion, prefijo) => {
  const id = typeof seleccion?.id === 'string' ? seleccion.id : '';

  return id.startsWith(`${prefijo}:`) ? id.slice(prefijo.length + 1) : null;
};

const opcionPorNumero = (contexto, entrada) => {
  const numero = Number(entrada);

  if (!Number.isInteger(numero) || numero < 1) return null;

  const opciones = Array.isArray(contexto.opciones) ? contexto.opciones : [];

  return opciones[numero - 1] ?? null;
};

const sumarDias = (fecha, dias) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(anio, mes - 1, dia + dias));

  return date.toISOString().slice(0, 10);
};

const sumarAnio = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);

  return `${anio + 1}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

/**
 * Acepta "AAAA-MM-DD", "DD/MM", "DD/MM/AAAA", "hoy" y "mañana".
 * Devuelve null cuando no se puede interpretar.
 */
const parsearFechaTexto = (entrada) => {
  if (!entrada) return null;

  if (entrada === 'hoy') return fechaHoyBogota();
  if (entrada === 'manana') return sumarDias(fechaHoyBogota(), 1);

  const iso = entrada.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (iso) {
    const fecha = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

    return esFechaValida(fecha) ? fecha : null;
  }

  const corta = entrada.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);

  if (!corta) return null;

  const [, dia, mes, anioCrudo] = corta;
  const hoy = fechaHoyBogota();
  const anio = anioCrudo
    ? anioCrudo.length === 2
      ? `20${anioCrudo}`
      : anioCrudo
    : hoy.slice(0, 4);
  let fecha = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;

  if (!esFechaValida(fecha)) return null;

  // "05/01" escrito en diciembre se refiere al año siguiente.
  if (!anioCrudo && fecha < hoy) fecha = sumarAnio(fecha);

  return fecha;
};

const parsearFechaEntrada = (entrada, seleccion) => {
  const id = idDe(seleccion, 'fecha');

  if (id && esFechaValida(id)) return id;

  return parsearFechaTexto(entrada);
};

const esProximosDias = (entrada) =>
  ['proximos dias', 'proximo', 'proximos', 'siguientes dias', 'cualquier dia'].includes(entrada);

const saludoPara = (contexto) => {
  const nombre = typeof contexto.nombrePerfil === 'string' ? contexto.nombrePerfil.trim() : '';
  const primero = nombre.split(/\s+/)[0];

  return primero ? `¡Hola, ${primero}!` : '¡Hola!';
};

const bloqueoDeCita = (cita) => {
  const inicio = aMinutos(cita.hora);

  if (inicio === null) return null;

  const duracion = Number(cita.servicio?.duracionMinutos) || DURACION_POR_DEFECTO;

  return { inicio, fin: inicio + duracion };
};

/**
 * Franjas libres de un día para un servicio. Si `profesionalId` es null se
 * combinan todos los profesionales activos y cada franja recuerda quién puede
 * atenderla. También se descartan las franjas que el paciente ya ocupa.
 */
const calcularFranjasDelDia = async ({
  fecha,
  duracionMinutos,
  profesionalId = null,
  pacienteId = null,
  excluirCitaId = null
}) => {
  if (!esFechaValida(fecha)) return { cerrado: false, franjas: [] };

  const rangos = await obtenerRangosDelDia(obtenerDiaSemana(fecha));

  if (!rangos.length) return { cerrado: true, franjas: [] };

  const citas = await db.Cita.findAll({
    where: {
      fecha,
      estado: { [Op.notIn]: ESTADOS_SIN_OCUPAR },
      ...(excluirCitaId ? { id: { [Op.ne]: excluirCitaId } } : {})
    },
    include: [{ model: db.Servicio, as: 'servicio', attributes: ['id', 'duracionMinutos'] }]
  });

  const profesionales = await db.Profesional.findAll({
    where: profesionalId ? { id: profesionalId } : { activo: true },
    attributes: ['id', 'nombre', 'apellido'],
    order: [['id', 'ASC']]
  });

  const duracion = Number(duracionMinutos) || DURACION_POR_DEFECTO;
  const ahora = fecha === fechaHoyBogota() ? aMinutos(horaActualBogota()) : null;
  const bloqueosPaciente = pacienteId
    ? citas
      .filter((cita) => Number(cita.pacienteId) === Number(pacienteId))
      .map(bloqueoDeCita)
      .filter(Boolean)
    : [];

  const porHora = new Map();

  for (const profesional of profesionales) {
    const bloqueos = [
      ...bloqueosPaciente,
      ...citas
        .filter((cita) => Number(cita.profesionalId) === Number(profesional.id))
        .map(bloqueoDeCita)
        .filter(Boolean)
    ];

    const franjas = generarFranjas({ rangos, duracionMinutos: duracion, bloqueos, ahora }).filter(
      (hora) => !bloqueos.some((bloqueo) => bloqueo.inicio === aMinutos(hora))
    );

    for (const hora of franjas) {
      if (porHora.has(hora)) continue;

      porHora.set(hora, {
        hora,
        profesionalId: profesional.id,
        profesionalNombre: `${profesional.nombre ?? ''} ${profesional.apellido ?? ''}`.trim()
      });
    }
  }

  return {
    cerrado: false,
    franjas: [...porHora.values()].sort((a, b) => a.hora.localeCompare(b.hora))
  };
};

const proximosDiasConCupo = async ({
  desde,
  cantidad = DIAS_SUGERIDOS,
  duracionMinutos,
  profesionalId = null,
  pacienteId = null,
  excluirCitaId = null
}) => {
  const dias = [];

  for (let indice = 0; indice < DIAS_BUSQUEDA && dias.length < cantidad; indice += 1) {
    const fecha = sumarDias(desde, indice);
    const { franjas } = await calcularFranjasDelDia({
      fecha,
      duracionMinutos,
      profesionalId,
      pacienteId,
      excluirCitaId
    });

    if (franjas.length) dias.push({ fecha, franjas });
  }

  return dias;
};

const pacienteDe = (conversacion, paciente) =>
  paciente ?? (conversacion?.pacienteId ? { id: conversacion.pacienteId } : null);

const registrarEscalamiento = async (conversacion, paciente, mensaje) => {
  try {
    await solicitudWhatsappService.registrarEscalamiento({
      conversacion,
      paciente: pacienteDe(conversacion, paciente),
      mensaje
    });
  } catch (error) {
    // El paciente siempre debe recibir respuesta aunque falle el registro.
    registrarError('escalamiento', error, { conversacionId: conversacion?.id });
  }
};

const derivarHumano = async (
  conversacion,
  paciente = null,
  { encabezado = null, mensaje = null } = {}
) => {
  await guardar(conversacion, ESTADOS_FLUJO.HUMANO, {
    ...LIMPIAR_RESERVA,
    humanoDesde: new Date().toISOString()
  });

  await registrarEscalamiento(conversacion, paciente, mensaje);

  return [texto([encabezado, MENSAJE_HUMANO].filter(Boolean).join('\n\n'))];
};

const mostrarMenu = async (conversacion, { saludo = true, encabezado = null } = {}) => {
  const contexto = leerContexto(conversacion);
  const cuerpo = [
    encabezado,
    saludo ? `${saludoPara(contexto)} Soy el asistente de DentAssist 🦷` : null,
    encabezado ? null : '¿Qué necesitas hacer?'
  ]
    .filter(Boolean)
    .join('\n\n');

  await guardar(conversacion, ESTADOS_FLUJO.MENU, {
    ...LIMPIAR_RESERVA,
    opciones: FILAS_MENU.map((fila) => fila.id)
  });

  return [lista(cuerpo, FILAS_MENU, { etiqueta: 'Ver opciones', seccion: 'Menú' })];
};

const construirPasoFecha = async (conversacion, { encabezado = null } = {}) => {
  const contexto = leerContexto(conversacion);
  const dias = await proximosDiasConCupo({
    desde: fechaHoyBogota(),
    duracionMinutos: contexto.duracionMinutos,
    profesionalId: contexto.profesionalId,
    pacienteId: conversacion.pacienteId,
    excluirCitaId: contexto.modo === 'reprogramacion' ? contexto.citaId : null
  });

  const opciones = dias.map((dia) => ({
    id: `fecha:${dia.fecha}`,
    titulo: formatearFechaCorta(dia.fecha)
  }));

  await guardar(conversacion, conversacion.estadoFlujo, {
    opciones: opciones.map((opcion) => opcion.id),
    diasOfrecidos: dias.map((dia) => dia.fecha)
  });

  const cuerpo = [
    encabezado,
    '¿Qué día te sirve?',
    opciones.length
      ? 'Elige una opción o escribe la fecha como AAAA-MM-DD.'
      : 'Escríbela como AAAA-MM-DD y reviso los cupos.'
  ]
    .filter(Boolean)
    .join('\n\n');

  return [opciones.length ? botones(cuerpo, opciones) : texto(cuerpo)];
};

const mostrarProximosDias = async (conversacion, { desde, encabezado }) => {
  const contexto = leerContexto(conversacion);
  const dias = await proximosDiasConCupo({
    desde,
    duracionMinutos: contexto.duracionMinutos,
    profesionalId: contexto.profesionalId,
    pacienteId: conversacion.pacienteId,
    excluirCitaId: contexto.modo === 'reprogramacion' ? contexto.citaId : null
  });

  if (!dias.length) {
    return derivarHumano(conversacion, null, {
      encabezado: `${encabezado} No encontré cupos en las próximas semanas.`
    });
  }

  const opciones = dias.map((dia) => ({
    id: `fecha:${dia.fecha}`,
    titulo: formatearFechaCorta(dia.fecha)
  }));

  await guardar(conversacion, conversacion.estadoFlujo, {
    opciones: opciones.map((opcion) => opcion.id),
    diasOfrecidos: dias.map((dia) => dia.fecha)
  });

  return [botones(`${encabezado}\n\nEstos días tienen cupo:`, opciones)];
};

const construirPasoHora = async (
  conversacion,
  {
    encabezado = null,
    estadoHora = ESTADOS_FLUJO.SOLICITAR_HORA,
    estadoFecha = ESTADOS_FLUJO.SOLICITAR_FECHA
  } = {}
) => {
  const contexto = leerContexto(conversacion);
  const { franjas } = await calcularFranjasDelDia({
    fecha: contexto.fecha,
    duracionMinutos: contexto.duracionMinutos,
    profesionalId: contexto.profesionalId,
    pacienteId: conversacion.pacienteId,
    excluirCitaId: contexto.modo === 'reprogramacion' ? contexto.citaId : null
  });

  if (!franjas.length) {
    // Al ofrecer otros días hay que volver al paso de fecha; si no, la lista de
    // fechas llegaría en un estado que espera una hora.
    await guardar(conversacion, estadoFecha, { fecha: null, hora: null });

    return mostrarProximosDias(conversacion, {
      desde: sumarDias(contexto.fecha, 1),
      encabezado: `No quedan cupos para el ${formatearFecha(contexto.fecha)}.`
    });
  }

  const visibles = franjas.slice(0, MAX_FRANJAS);
  const filas = visibles.map((franja) => ({
    id: `hora:${franja.hora}`,
    titulo: franja.hora,
    descripcion: `Con ${franja.profesionalNombre || 'el profesional'}`
  }));

  filas.push({ id: 'hora:otro', titulo: 'Otro día', descripcion: 'Elige otra fecha' });

  await guardar(conversacion, estadoHora, {
    franjasOfertadas: visibles,
    opciones: filas.map((fila) => fila.id)
  });

  const cuerpo = [
    encabezado,
    `Cupos para el ${formatearFecha(contexto.fecha)} · ${contexto.servicioNombre} (${contexto.duracionMinutos} min).`,
    'Elige una franja:'
  ]
    .filter(Boolean)
    .join('\n\n');

  return [lista(cuerpo, filas, { etiqueta: 'Ver horarios', seccion: 'Horarios' })];
};

const resumenCita = (contexto) =>
  [
    '📋 *Confirma tu cita*',
    '',
    `• Servicio: ${contexto.servicioNombre} (${contexto.duracionMinutos} min)`,
    `• Profesional: ${contexto.profesionalNombre}`,
    `• Fecha: ${formatearFecha(contexto.fecha)}`,
    `• Hora: ${contexto.hora}`,
    contexto.descripcion ? `• Asunto: ${contexto.descripcion}` : null,
    '',
    '¿Agendamos?'
  ].filter(Boolean).join('\n');

const salidaConfirmacion = (contexto) =>
  botones(resumenCita(contexto), [
    { id: 'confirmar:si', titulo: 'Sí, agendar' },
    { id: 'confirmar:no', titulo: 'Elegir otra hora' }
  ]);

const buscarServicioPorTexto = (entrada, servicios) => {
  if (entrada.length < 3) return null;

  const normalizados = servicios.map((servicio) => ({ servicio, nombre: normalizar(servicio.nombre) }));
  const exacto = normalizados.find((item) => item.nombre === entrada);

  if (exacto) return exacto.servicio;

  return normalizados.find((item) => item.nombre.includes(entrada))?.servicio ?? null;
};

const buscarProfesionalPorTexto = (entrada, profesionales) => {
  if (entrada.length < 3) return null;

  return (
    profesionales.find((profesional) => {
      const nombre = normalizar(`${profesional.nombre ?? ''} ${profesional.apellido ?? ''}`);

      return nombre === entrada || nombre.includes(entrada);
    }) ?? null
  );
};

const iniciarServicio = async (conversacion, modo) => {
  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_SERVICIO, { ...LIMPIAR_RESERVA, modo });

  return construirPasoServicio(conversacion, {
    encabezado:
      modo === 'disponibilidad'
        ? 'Vamos a revisar la disponibilidad.'
        : 'Vamos a agendar tu cita.'
  });
};

const iniciarCrearSolicitud = async (conversacion) => {
  await guardar(conversacion, ESTADOS_FLUJO.CREAR_SOLICITUD, {});
  return [texto('Escribe tu solicitud o consulta. La enviaremos al equipo de recepción para que te atiendan lo antes posible.')];
};

const manejarCrearSolicitud = async (conversacion, paciente, mensaje) => {
  const contenido = (mensaje?.contenido || '').trim();
  if (!contenido) {
    return [texto('Por favor escribe tu solicitud para poder enviarla.')];
  }

  try {
    const solicitud = await solicitudWhatsappService.crearSolicitudDesdeWhatsApp({
      conversacion,
      paciente,
      mensaje: contenido
    });

    await guardar(conversacion, ESTADOS_FLUJO.MENU, { ...LIMPIAR_RESERVA, opciones: FILAS_MENU.map((fila) => fila.id) });
    
    return [
      texto(`Solicitud creada correctamente.\n\nSolicitud #${solicitud.id}\n\n${contenido}\n\nLos recepcionistas la atenderán. Te avisaremos por aquí cuando se resuelva.`),
      lista('Escribe *menú* para volver al menú principal.', FILAS_MENU, { etiqueta: 'Ver opciones', seccion: 'Menú' })
    ];
  } catch (error) {
    registrarError('whatsapp_crear_solicitud', error, { conversacionId: conversacion?.id });
    await guardar(conversacion, ESTADOS_FLUJO.MENU, { ...LIMPIAR_RESERVA, opciones: FILAS_MENU.map((fila) => fila.id) });
    return [texto('Hubo un error al crear tu solicitud. Por favor intenta nuevamente o escribe *menú* para volver.')];
  }
};

const iniciarActualizacionDatos = async (conversacion, paciente) => {
  await guardar(conversacion, ESTADOS_FLUJO.ACTUALIZAR_NOMBRE, {});
  return [texto('Vamos a actualizar tus datos.\n\n¿Cuál es tu nombre?')];
};

const manejarActualizacionDatos = async (conversacion, paciente, estado, valor) => {
  const ctx = leerContexto(conversacion);
  if (estado === ESTADOS_FLUJO.ACTUALIZAR_NOMBRE) {
    await guardar(conversacion, ESTADOS_FLUJO.ACTUALIZAR_APELLIDO, { nombreNuevo: valor.trim() });
    return [texto('¿Cuál es tu apellido?')];
  }
  if (estado === ESTADOS_FLUJO.ACTUALIZAR_APELLIDO) {
    await guardar(conversacion, ESTADOS_FLUJO.ACTUALIZAR_CORREO, { apellidoNuevo: valor.trim() });
    return [texto('¿Cuál es tu correo electrónico?')];
  }
  if (estado === ESTADOS_FLUJO.ACTUALIZAR_CORREO) {
    try {
      if (paciente) {
        await paciente.update({ nombre: ctx.nombreNuevo || paciente.nombre, apellido: ctx.apellidoNuevo || paciente.apellido, correo: valor.trim() });
      }
    } catch (e) {
      // ignore
    }
    await guardar(conversacion, ESTADOS_FLUJO.MENU, { ...LIMPIAR_RESERVA, opciones: FILAS_MENU.map((fila) => fila.id) });
    return [texto('Datos actualizados correctamente.\n\nEscribe *menú* para volver.')];
  }
  return mostrarMenu(conversacion, { saludo: false });
};

const construirPasoServicio = async (conversacion, { encabezado = null } = {}) => {
  const servicios = await db.Servicio.findAll({
    where: { activo: true },
    order: [['nombre', 'ASC']],
    limit: MAX_SERVICIOS
  });

  if (!servicios.length) {
    return derivarHumano(conversacion, null, {
      encabezado: 'No hay servicios disponibles en este momento.'
    });
  }

  const filas = servicios.map((servicio) => ({
    id: `serv:${servicio.id}`,
    titulo: servicio.nombre,
    descripcion: `${Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO} min · ${formatearPrecio(servicio.precio)}`
  }));

  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_SERVICIO, {
    opciones: filas.map((fila) => fila.id)
  });

  const cuerpo = [encabezado, '¿Qué servicio te interesa?'].filter(Boolean).join('\n\n');

  return [lista(cuerpo, filas, { etiqueta: 'Ver servicios', seccion: 'Servicios' })];
};

const construirPasoProfesional = async (conversacion, { encabezado = null } = {}) => {
  const profesionales = await db.Profesional.findAll({
    where: { activo: true },
    attributes: ['id', 'nombre', 'apellido', 'especialidad'],
    order: [['nombre', 'ASC']],
    limit: MAX_PROFESIONALES
  });

  const filas = profesionales.map((profesional) => ({
    id: `prof:${profesional.id}`,
    titulo: `${profesional.nombre ?? ''} ${profesional.apellido ?? ''}`.trim(),
    descripcion: profesional.especialidad || 'Odontología'
  }));

  filas.push({
    id: 'prof:cualquiera',
    titulo: 'Cualquiera disponible',
    descripcion: 'El primero con cupo'
  });

  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_PROFESIONAL, {
    opciones: filas.map((fila) => fila.id)
  });

  const cuerpo = [encabezado, '¿Con qué profesional prefieres atenderte?']
    .filter(Boolean)
    .join('\n\n');

  return [lista(cuerpo, filas, { etiqueta: 'Ver profesionales', seccion: 'Profesionales' })];
};

const filasCitas = (citas) =>
  citas.map((cita) => ({
    id: `cita:${cita.id}`,
    titulo: `${formatearFechaCorta(cita.fecha)} · ${String(cita.hora ?? '').slice(0, 5)}`,
    descripcion: cita.servicio?.nombre || 'Cita'
  }));

const volverAlMenu = async (conversacion, mensaje) => {
  await guardar(conversacion, ESTADOS_FLUJO.MENU, {
    ...LIMPIAR_RESERVA,
    opciones: FILAS_MENU.map((fila) => fila.id)
  });

  return [texto(mensaje)];
};

const iniciarGestionCita = async (conversacion, { tipo, encabezado = null }) => {
  const citas = await solicitudWhatsappService.listarCitasFuturas(conversacion.pacienteId);

  if (!citas.length) {
    await guardar(conversacion, ESTADOS_FLUJO.MENU, {
      ...LIMPIAR_RESERVA,
      opciones: FILAS_MENU.map((fila) => fila.id)
    });

    return [texto(MENSAJE_SIN_CITAS)];
  }

  const filas = filasCitas(citas);
  const estado =
    tipo === 'cancelacion' ? ESTADOS_FLUJO.CANCELAR_CITA : ESTADOS_FLUJO.REPROGRAMAR_CITA;

  await guardar(conversacion, estado, {
    ...LIMPIAR_RESERVA,
    modo: tipo,
    citasOfrecidas: citas.map((cita) => cita.id),
    opciones: filas.map((fila) => fila.id)
  });

  const cuerpo = [
    encabezado,
    tipo === 'cancelacion'
      ? '¿Cuál cita quieres cancelar?\n\nLa cita sigue activa hasta que recepción confirme la cancelación.'
      : '¿Cuál cita quieres reprogramar?\n\nDespués eliges la nueva fecha y hora.'
  ]
    .filter(Boolean)
    .join('\n\n');

  return [lista(cuerpo, filas, { etiqueta: 'Ver citas', seccion: 'Tus citas' })];
};

const iniciarCancelacion = (conversacion) =>
  iniciarGestionCita(conversacion, { tipo: 'cancelacion' });

const iniciarReprogramacion = (conversacion) =>
  iniciarGestionCita(conversacion, { tipo: 'reprogramacion' });

const citaElegida = (contexto, entrada, seleccion) => {
  const id = idDe(seleccion, 'cita');

  if (id && /^\d+$/.test(id)) return Number(id);

  const porNumero = opcionPorNumero(contexto, entrada);

  if (porNumero && porNumero.startsWith('cita:')) {
    return Number(porNumero.slice('cita:'.length));
  }

  return null;
};

const manejarCitaGestion = async (conversacion, paciente, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const tipo =
    conversacion.estadoFlujo === ESTADOS_FLUJO.CANCELAR_CITA
      ? 'cancelacion'
      : 'reprogramacion';
  const citaId = citaElegida(contexto, entrada, seleccion);

  if (!citaId) {
    return iniciarGestionCita(conversacion, {
      tipo,
      encabezado: 'No entendí esa opción.'
    });
  }

  const ofrecidas = Array.isArray(contexto.citasOfrecidas)
    ? contexto.citasOfrecidas.map(Number)
    : [];

  if (ofrecidas.length && !ofrecidas.includes(citaId)) {
    return iniciarGestionCita(conversacion, {
      tipo,
      encabezado: 'Esa cita no estaba en la lista. Elige una de las opciones.'
    });
  }

  const cita = await solicitudWhatsappService.obtenerCitaFutura(
    conversacion.pacienteId,
    citaId
  );

  if (!cita) {
    return volverAlMenu(conversacion, MENSAJE_CITA_NO_DISPONIBLE);
  }

  const abierta = await solicitudWhatsappService.buscarSolicitudAbierta(cita.id);

  if (abierta) {
    return volverAlMenu(conversacion, MENSAJE_SOLICITUD_ABIERTA);
  }

  if (tipo === 'cancelacion') {
    const resultado = await solicitudWhatsappService.crearSolicitudCita({
      conversacion,
      paciente,
      citaId: cita.id,
      tipo
    });

    if (resultado.estado === 'duplicada') {
      return volverAlMenu(conversacion, MENSAJE_SOLICITUD_ABIERTA);
    }

    if (resultado.estado !== 'ok') {
      return volverAlMenu(conversacion, MENSAJE_CITA_NO_DISPONIBLE);
    }

    return volverAlMenu(conversacion, MENSAJE_CANCELACION_PENDIENTE);
  }

  await guardar(conversacion, ESTADOS_FLUJO.REPROGRAMAR_FECHA, {
    ...LIMPIAR_RESERVA,
    modo: 'reprogramacion',
    citaId: cita.id,
    citaOriginal: { fecha: cita.fecha, hora: cita.hora },
    servicioId: cita.servicioId ?? cita.servicio?.id ?? null,
    servicioNombre: cita.servicio?.nombre ?? 'tu servicio',
    duracionMinutos: Number(cita.servicio?.duracionMinutos) || DURACION_POR_DEFECTO,
    profesionalId: cita.profesionalId ?? null,
    profesionalNombre: 'tu profesional'
  });

  return construirPasoFecha(conversacion, {
    encabezado: `Vas a reprogramar la cita #${cita.id} del ${formatearFecha(cita.fecha)} a las ${String(cita.hora ?? '').slice(0, 5)}.`
  });
};

const manejarReprogramarFecha = async (conversacion, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);

  if (esProximosDias(entrada)) {
    return mostrarProximosDias(conversacion, {
      desde: fechaHoyBogota(),
      encabezado: 'Estos son los próximos días con cupo.'
    });
  }

  const fecha = parsearFechaEntrada(entrada, seleccion);

  if (!fecha) {
    return construirPasoFecha(conversacion, { encabezado: 'No entendí la fecha.' });
  }

  const hoy = fechaHoyBogota();

  if (fecha < hoy) {
    return construirPasoFecha(conversacion, { encabezado: 'Esa fecha ya pasó.' });
  }

  if (fecha > sumarDias(hoy, DIAS_LIMITE)) {
    return construirPasoFecha(conversacion, {
      encabezado: `Solo agendamos hasta el ${formatearFecha(sumarDias(hoy, DIAS_LIMITE))}.`
    });
  }

  const { franjas } = await calcularFranjasDelDia({
    fecha,
    duracionMinutos: contexto.duracionMinutos,
    profesionalId: contexto.profesionalId,
    pacienteId: conversacion.pacienteId,
    excluirCitaId: contexto.citaId
  });

  if (!franjas.length) {
    await guardar(conversacion, ESTADOS_FLUJO.REPROGRAMAR_FECHA, {
      fecha: null,
      hora: null
    });

    return mostrarProximosDias(conversacion, {
      desde: sumarDias(fecha, 1),
      encabezado: `No hay cupos para el ${formatearFecha(fecha)}.`
    });
  }

  await guardar(conversacion, ESTADOS_FLUJO.REPROGRAMAR_HORA, { fecha, hora: null });

  return construirPasoHora(conversacion, {
    estadoHora: ESTADOS_FLUJO.REPROGRAMAR_HORA,
    estadoFecha: ESTADOS_FLUJO.REPROGRAMAR_FECHA
  });
};

const manejarReprogramarHora = async (conversacion, paciente, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const id = idDe(seleccion, 'hora');

  if (id === 'otro' || esProximosDias(entrada)) {
    await guardar(conversacion, ESTADOS_FLUJO.REPROGRAMAR_FECHA, {
      fecha: null,
      hora: null
    });

    return construirPasoFecha(conversacion, { encabezado: 'Elige otro día.' });
  }

  const horaSeleccionada = id ?? (entrada.match(/^(\d{1,2}):(\d{2})$/)
    ? `${entrada.split(':')[0].padStart(2, '0')}:${entrada.split(':')[1]}`
    : null);
  const hora = horaSeleccionada && /^\d{2}:\d{2}$/.test(horaSeleccionada) ? horaSeleccionada : null;
  const opcionesHora = {
    estadoHora: ESTADOS_FLUJO.REPROGRAMAR_HORA,
    estadoFecha: ESTADOS_FLUJO.REPROGRAMAR_FECHA
  };

  if (!hora) {
    return construirPasoHora(conversacion, {
      ...opcionesHora,
      encabezado: 'No entendí esa opción.'
    });
  }

  const ofertadas = Array.isArray(contexto.franjasOfertadas) ? contexto.franjasOfertadas : [];
  const franja = ofertadas.find((item) => item.hora === hora);

  if (!franja) {
    return construirPasoHora(conversacion, {
      ...opcionesHora,
      encabezado: 'Ese cupo ya no está disponible. Elige otro:'
    });
  }

  const resultado = await solicitudWhatsappService.crearSolicitudCita({
    conversacion,
    paciente,
    citaId: contexto.citaId,
    tipo: 'reprogramacion',
    fechaPropuesta: contexto.fecha,
    horaPropuesta: hora
  });

  if (resultado.estado === 'duplicada') {
    return volverAlMenu(conversacion, MENSAJE_SOLICITUD_ABIERTA);
  }

  if (resultado.estado !== 'ok') {
    return volverAlMenu(conversacion, MENSAJE_CITA_NO_DISPONIBLE);
  }

  return volverAlMenu(
    conversacion,
    `${MENSAJE_REPROGRAMACION_PENDIENTE}\n\nPropuesta: ${formatearFecha(contexto.fecha)} a las ${hora}.`
  );
};

const manejarMenu = async (conversacion, paciente, entrada, seleccion, mensaje) => {
  const contexto = leerContexto(conversacion);
  const id = idDe(seleccion, 'menu');
  const porNumero = opcionPorNumero(contexto, entrada);
  const opcion = id ?? (porNumero ? porNumero.slice(5) : null) ?? resolverMenuPorTexto(entrada);

  switch (opcion) {
    case 'servicios':
      return mostrarServicios(conversacion);
    case 'disponibilidad':
      return iniciarServicio(conversacion, 'disponibilidad');
    case 'solicitar':
      return iniciarServicio(conversacion, 'reserva');
    case 'cancelar':
      return iniciarCancelacion(conversacion);
    case 'reprogramar':
      return iniciarReprogramacion(conversacion);
    case 'crear_solicitud':
      return iniciarCrearSolicitud(conversacion);
    case 'actualizar_datos':
      return iniciarActualizacionDatos(conversacion, paciente);
    default:
      // Una selección o un número fuera de rango es un error de pulsación; el
      // texto libre desconocido se escala a una persona.
      if (seleccion || /^\d+$/.test(entrada)) {
        return mostrarMenu(conversacion, {
          saludo: false,
          encabezado: 'No entendí esa opción.'
        });
      }

      return derivarHumano(conversacion, paciente, {
        encabezado: 'Entiendo que necesitas ayuda con otra cosa.',
        mensaje: mensaje?.contenido
      });
  }
};

const resolverMenuPorTexto = (entrada) => {
  const mapa = {
    '1': 'servicios',
    servicios: 'servicios',
    'servicios y horarios': 'servicios',
    horarios: 'servicios',
    '2': 'disponibilidad',
    disponibilidad: 'disponibilidad',
    cupos: 'disponibilidad',
    '3': 'solicitar',
    solicitar: 'solicitar',
    'solicitar cita': 'solicitar',
    agendar: 'solicitar',
    cita: 'solicitar',
    '4': 'cancelar',
    cancelar: 'cancelar',
    'cancelar cita': 'cancelar',
    '5': 'reprogramar',
    reprogramar: 'reprogramar',
    '6': 'crear_solicitud',
    'crear solicitud': 'crear_solicitud',
    crear: 'crear_solicitud',
    solicitud: 'crear_solicitud',
    '7': 'actualizar_datos',
    'actualizar mis datos': 'actualizar_datos',
    'actualizar datos': 'actualizar_datos',
    datos: 'actualizar_datos'
  };

  return mapa[entrada] ?? null;
};

const mostrarServicios = async (conversacion) => {
  const [servicios, horarios] = await Promise.all([
    db.Servicio.findAll({
      where: { activo: true },
      order: [['nombre', 'ASC']],
      limit: 15
    }),
    db.HorarioAtencion.findAll({
      where: { activo: true },
      order: [['diaSemana', 'ASC'], ['horaInicio', 'ASC']]
    })
  ]);

  const lineasServicios = servicios.length
    ? servicios.map((servicio) => {
      const duracion = Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO;

      return `• ${servicio.nombre}\n  ${duracion} min · ${formatearPrecio(servicio.precio)}`;
    })
    : ['• Por ahora no hay servicios publicados.'];

  const porDia = new Map();

  for (const horario of horarios) {
    const dia = Number(horario.diaSemana);
    const inicio = formatearMinutos(aMinutos(horario.horaInicio) ?? 0);
    const fin = formatearMinutos(aMinutos(horario.horaFin) ?? 0);

    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(`${inicio} a ${fin}`);
  }

  const nombresDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const lineasHorario = porDia.size
    ? [...porDia.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dia, rangos]) => `• ${nombresDia[dia]}: ${rangos.join(', ')}`)
    : ['• Horario por confirmar.'];

  await guardar(conversacion, ESTADOS_FLUJO.INFO_SERVICIOS, { opciones: ['menu:volver'] });

  return [
    texto(
      [
        '🦷 *Servicios y precios*',
        '',
        ...lineasServicios,
        '',
        '🕒 *Horario de atención*',
        '',
        ...lineasHorario,
        '',
        'Escribe *menú* para volver.'
      ].join('\n')
    )
  ];
};

const manejarServicio = async (conversacion, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const servicios = await db.Servicio.findAll({
    where: { activo: true },
    order: [['nombre', 'ASC']],
    limit: MAX_SERVICIOS
  });

  const id = idDe(seleccion, 'serv');
  const porNumero = opcionPorNumero(contexto, entrada);
  const servicio =
    (id ? servicios.find((item) => Number(item.id) === Number(id)) : null) ??
    (porNumero ? servicios.find((item) => `serv:${item.id}` === porNumero) : null) ??
    buscarServicioPorTexto(entrada, servicios);

  if (!servicio) {
    return construirPasoServicio(conversacion, { encabezado: 'No entendí esa opción.' });
  }

  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_PROFESIONAL, {
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    duracionMinutos: Number(servicio.duracionMinutos) || DURACION_POR_DEFECTO
  });

  return construirPasoProfesional(conversacion, { encabezado: `Servicio: ${servicio.nombre}` });
};

const manejarProfesional = async (conversacion, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const profesionales = await db.Profesional.findAll({
    where: { activo: true },
    attributes: ['id', 'nombre', 'apellido'],
    order: [['nombre', 'ASC']],
    limit: MAX_PROFESIONALES
  });

  const id = idDe(seleccion, 'prof');
  const porNumero = opcionPorNumero(contexto, entrada);
  const opcion = id ?? (porNumero ? porNumero.slice(5) : null);
  const esCualquiera =
    opcion === 'cualquiera' || ['cualquiera', 'cualquiera disponible', 'sin preferencia'].includes(entrada);

  let profesionalId = null;
  let profesionalNombre = 'Cualquiera disponible';

  if (!esCualquiera) {
    const elegido = opcion
      ? profesionales.find((item) => Number(item.id) === Number(opcion))
      : buscarProfesionalPorTexto(entrada, profesionales);

    if (!elegido) {
      return construirPasoProfesional(conversacion, { encabezado: 'No entendí esa opción.' });
    }

    profesionalId = elegido.id;
    profesionalNombre = `${elegido.nombre ?? ''} ${elegido.apellido ?? ''}`.trim();
  }

  const siguienteEstado =
    contexto.modo === 'disponibilidad'
      ? ESTADOS_FLUJO.DISPONIBILIDAD
      : ESTADOS_FLUJO.SOLICITAR_FECHA;

  await guardar(conversacion, siguienteEstado, { profesionalId, profesionalNombre });

  return construirPasoFecha(conversacion, {
    encabezado: `Profesional: ${profesionalNombre}`
  });
};

const manejarFecha = async (conversacion, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const esDisponibilidad = conversacion.estadoFlujo === ESTADOS_FLUJO.DISPONIBILIDAD;

  if (esProximosDias(entrada)) {
    return mostrarProximosDias(conversacion, {
      desde: fechaHoyBogota(),
      encabezado: 'Estos son los próximos días con cupo.'
    });
  }

  const fecha = parsearFechaEntrada(entrada, seleccion);

  if (!fecha) {
    return construirPasoFecha(conversacion, { encabezado: 'No entendí la fecha.' });
  }

  const hoy = fechaHoyBogota();

  if (fecha < hoy) {
    return construirPasoFecha(conversacion, { encabezado: 'Esa fecha ya pasó.' });
  }

  if (fecha > sumarDias(hoy, DIAS_LIMITE)) {
    return construirPasoFecha(conversacion, {
      encabezado: `Solo agendamos hasta el ${formatearFecha(sumarDias(hoy, DIAS_LIMITE))}.`
    });
  }

  const { franjas } = await calcularFranjasDelDia({
    fecha,
    duracionMinutos: contexto.duracionMinutos,
    profesionalId: contexto.profesionalId,
    pacienteId: conversacion.pacienteId
  });

  if (!franjas.length) {
    return mostrarProximosDias(conversacion, {
      desde: sumarDias(fecha, 1),
      encabezado: `No hay cupos para el ${formatearFecha(fecha)}.`
    });
  }

  if (esDisponibilidad) {
    const visibles = franjas.slice(0, MAX_FRANJAS);
    const detalle = franjas.length > MAX_FRANJAS ? `\nHay ${franjas.length} cupos en total.` : '';

    await guardar(conversacion, ESTADOS_FLUJO.MENU, { ...LIMPIAR_RESERVA });

    return [
      texto(
        [
          `📅 *Cupos para el ${formatearFecha(fecha)}*`,
          '',
          `• Servicio: ${contexto.servicioNombre} (${contexto.duracionMinutos} min)`,
          `• Profesional: ${contexto.profesionalNombre}`,
          '',
          ...visibles.map((franja) => `• ${franja.hora}`),
          detalle
        ].filter((linea) => linea !== '').join('\n')
      ),
      botones('¿Quieres reservar uno de estos cupos?', [
        { id: 'menu:solicitar', titulo: 'Solicitar cita' },
        { id: 'menu:volver', titulo: 'Volver al menú' }
      ])
    ];
  }

  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_HORA, { fecha, hora: null });

  return construirPasoHora(conversacion);
};

const manejarHora = async (conversacion, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const id = idDe(seleccion, 'hora');

  if (id === 'otro' || esProximosDias(entrada)) {
    await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_FECHA, { fecha: null, hora: null });
    return construirPasoFecha(conversacion, { encabezado: 'Elige otro día.' });
  }

  const horaSeleccionada = id ?? (entrada.match(/^(\d{1,2}):(\d{2})$/)
    ? `${entrada.split(':')[0].padStart(2, '0')}:${entrada.split(':')[1]}`
    : null);
  const hora = horaSeleccionada && /^\d{2}:\d{2}$/.test(horaSeleccionada) ? horaSeleccionada : null;

  if (!hora) {
    return construirPasoHora(conversacion, { encabezado: 'No entendí esa opción.' });
  }

  const ofertadas = Array.isArray(contexto.franjasOfertadas) ? contexto.franjasOfertadas : [];
  const franja = ofertadas.find((item) => item.hora === hora);

  if (!franja) {
    return construirPasoHora(conversacion, {
      encabezado: 'Ese cupo ya no está disponible. Elige otro:'
    });
  }

  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_DESCRIPCION, {
    hora,
    profesionalId: franja.profesionalId,
    profesionalNombre: franja.profesionalNombre || contexto.profesionalNombre
  });

  return [texto('Describe brevemente el motivo o asunto de tu cita (puedes escribirlo ahora):')];
};

const manejarDescripcion = async (conversacion, paciente, entrada) => {
  const contexto = leerContexto(conversacion);
  const descripcion = entrada.trim();
  await guardar(conversacion, ESTADOS_FLUJO.CONFIRMAR, { descripcion });
  return [salidaConfirmacion({ ...contexto, descripcion })];
};

const manejarConfirmacion = async (conversacion, paciente, entrada, seleccion) => {
  const contexto = leerContexto(conversacion);
  const id = idDe(seleccion, 'confirmar');
  const afirmativo = id === 'si' || ['si', 'confirmo', 'dale', 'ok', 'esta bien'].includes(entrada);
  const negativo =
    id === 'no' || ['no', 'cambiar', 'otra hora', 'otra franja'].includes(entrada);

  if (negativo) {
    await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_HORA, { hora: null });
    return construirPasoHora(conversacion, { encabezado: 'Sin problema, elige otra franja.' });
  }

  if (!afirmativo) {
    return [botones(`No entendí tu respuesta.\n\n${resumenCita(contexto)}`, [
      { id: 'confirmar:si', titulo: 'Sí, agendar' },
      { id: 'confirmar:no', titulo: 'Elegir otra hora' }
    ])];
  }

  const huella = [
    contexto.servicioId,
    contexto.profesionalId ?? 'cualquiera',
    contexto.fecha,
    contexto.hora
  ].join('|');
  const previa = contexto.ultimaConfirmacion;
  const confirmacionReciente =
    previa && Date.now() - Number(previa.en ?? 0) < VIGENCIA_CONFIRMACION_MS;
  const sinReservaActiva = !contexto.servicioId || !contexto.fecha || !contexto.hora;

  // Dos protecciones: la huella del último intento (mismo cupo) y el caso en
  // que el contexto ya se limpió tras agendar pero el estado seguía en
  // `confirmar`. Así una doble pulsación no vuelve a llamar a citaService.
  if (confirmacionReciente && (previa.huella === huella || sinReservaActiva)) {
    await guardar(conversacion, ESTADOS_FLUJO.MENU, {
      opciones: FILAS_MENU.map((fila) => fila.id)
    });

    return [
      texto(
        `Tu cita #${previa.citaId} ya quedó agendada para el ${formatearFecha(previa.fecha ?? contexto.fecha)} a las ${previa.hora ?? contexto.hora}.`
      )
    ];
  }

  try {
    const cita = await citaService.crearCita({
      pacienteId: paciente.id,
      profesionalId: contexto.profesionalId,
      servicioId: contexto.servicioId,
      fecha: contexto.fecha,
      hora: contexto.hora,
      estado: 'programada',
      observaciones: contexto.descripcion ? `Reservada por WhatsApp - ${contexto.descripcion}` : 'Reservada por el asistente de WhatsApp'
    });

    const profesional = `${cita.profesional?.nombre ?? ''} ${cita.profesional?.apellido ?? ''}`.trim();

    await guardar(conversacion, ESTADOS_FLUJO.MENU, {
      opciones: FILAS_MENU.map((fila) => fila.id),
      ultimaCita: {
        id: cita.id,
        fecha: cita.fecha,
        hora: cita.hora,
        servicio: cita.servicio?.nombre ?? contexto.servicioNombre,
        profesional: profesional || contexto.profesionalNombre
      },
      ultimaConfirmacion: { huella, citaId: cita.id, en: Date.now(), fecha: cita.fecha, hora: cita.hora }
    });

    return [
      texto(
        [
          '✅ *Cita agendada*',
          '',
          `📋 Cita #${cita.id}`,
          `• Servicio: ${cita.servicio?.nombre ?? contexto.servicioNombre}`,
          `• Profesional: ${profesional || contexto.profesionalNombre}`,
          `• Fecha: ${formatearFecha(cita.fecha)}`,
          `• Hora: ${String(cita.hora).slice(0, 5)}`,
          '',
          'Te esperamos. Si necesitas cambiarla, escribe *menú* y elige *Hablar con una persona*.'
        ].join('\n')
      )
    ];
  } catch (error) {
    if (error.statusCode !== 409) throw error;

    return manejarConflicto(conversacion, contexto);
  }
};

const manejarConflicto = async (conversacion, contexto) => {
  const { franjas } = await calcularFranjasDelDia({
    fecha: contexto.fecha,
    duracionMinutos: contexto.duracionMinutos,
    profesionalId: contexto.profesionalId,
    pacienteId: conversacion.pacienteId
  });

  if (!franjas.length) {
    await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_FECHA, { fecha: null, hora: null });

    return mostrarProximosDias(conversacion, {
      desde: sumarDias(contexto.fecha, 1),
      encabezado: '😕 Ese horario se acaba de ocupar y ya no quedan cupos ese día.'
    });
  }

  await guardar(conversacion, ESTADOS_FLUJO.SOLICITAR_HORA, { hora: null });

  return construirPasoHora(conversacion, {
    encabezado: '😕 Ese horario se acaba de ocupar. Estos son los cupos que quedan:'
  });
};

const detectarComando = (entrada, seleccion) => {
  if (seleccion?.id === 'menu' || seleccion?.id === 'menu:volver') return 'menu';

  const comandos = {
    menu: [
      'menu',
      'inicio',
      'hola',
      'buenas',
      'buenos dias',
      'buenas tardes',
      'buenas noches',
      'volver',
      'atras',
      '0'
    ],
    cancelar: ['cancelar', 'salir'],
    humano: ['humano', 'asesor', 'asesora', 'persona', 'recepcion']
  };

  for (const [comando, palabras] of Object.entries(comandos)) {
    if (palabras.includes(entrada)) return comando;
  }

  return null;
};

// En estado `humano` la conversación queda en manos de recepción. Solo un
// regreso explícito al menú reactiva el asistente.
const esMenuExplicito = (entrada, seleccion) =>
  seleccion?.id === 'menu' ||
  seleccion?.id === 'menu:volver' ||
  ['menu', 'inicio', 'volver', 'atras', '0'].includes(entrada);

/**
 * Avanza la conversación según el estado persistido. No envía nada: devuelve
 * las salidas para que el servicio de WhatsApp las persista y las entregue.
 */
const procesar = async ({ conversacion, paciente, mensaje, seleccion = null }) => {
  const entrada = normalizar(mensaje?.contenido);

  if (conversacion.estadoFlujo === ESTADOS_FLUJO.HUMANO) {
    return mostrarMenu(conversacion, { saludo: false, encabezado: 'El chat con humano ya no está disponible. Usa el menú.' });
  }

  const comando = detectarComando(entrada, seleccion);

  if (comando === 'humano') {
    return mostrarMenu(conversacion, { saludo: false, encabezado: 'La opción "Hablar con una persona" ya no está disponible. Usa el menú para agendar, cancelar o reprogramar tu cita.' });
  }

  // En el menú, "cancelar" inicia el flujo de cancelación de una cita. En los
  // demás pasos sigue funcionando como atajo para abandonar la reserva.
  const cancelarEnMenu =
    conversacion.estadoFlujo === ESTADOS_FLUJO.MENU && entrada === 'cancelar';

  if (comando === 'cancelar' && !cancelarEnMenu) {
    const estabaEnMenu = [
      ESTADOS_FLUJO.INICIAL,
      ESTADOS_FLUJO.AVISO_ENVIADO,
      ESTADOS_FLUJO.MENU,
      ESTADOS_FLUJO.INFO_SERVICIOS
    ].includes(conversacion.estadoFlujo);

    return mostrarMenu(conversacion, {
      saludo: false,
      encabezado: estabaEnMenu ? null : 'Listo, cancelé el proceso. No se agendó ninguna cita.'
    });
  }

  if (comando === 'menu') return mostrarMenu(conversacion, { saludo: false });

  switch (conversacion.estadoFlujo) {
    case ESTADOS_FLUJO.INICIAL:
    case ESTADOS_FLUJO.AVISO_ENVIADO:
    case ESTADOS_FLUJO.INFO_SERVICIOS:
      return mostrarMenu(conversacion, { saludo: false });
    case ESTADOS_FLUJO.REGISTRO_NOMBRE:
      if (paciente) {
        await paciente.update({ nombre: mensaje?.contenido?.trim() });
        await guardar(conversacion, ESTADOS_FLUJO.REGISTRO_APELLIDO, {});
        return [texto('¿Cuál es tu apellido?')];
      }
      break;
    case ESTADOS_FLUJO.REGISTRO_APELLIDO:
      if (paciente) {
        await paciente.update({ apellido: mensaje?.contenido?.trim() });
        await guardar(conversacion, ESTADOS_FLUJO.REGISTRO_CORREO, {});
        return [texto('¿Cuál es tu correo electrónico?')];
      }
      break;
    case ESTADOS_FLUJO.REGISTRO_CORREO:
      if (paciente) {
        await paciente.update({ correo: mensaje?.contenido?.trim() });
      }
      await guardar(conversacion, ESTADOS_FLUJO.MENU, { ...LIMPIAR_RESERVA, opciones: FILAS_MENU.map((fila) => fila.id) });
      return mostrarMenu(conversacion, { saludo: true, encabezado: 'Datos guardados correctamente.' });
    case ESTADOS_FLUJO.MENU:
      return manejarMenu(conversacion, paciente, entrada, seleccion, mensaje);
    case ESTADOS_FLUJO.SOLICITAR_SERVICIO:
      return manejarServicio(conversacion, entrada, seleccion);
    case ESTADOS_FLUJO.SOLICITAR_PROFESIONAL:
      return manejarProfesional(conversacion, entrada, seleccion);
    case ESTADOS_FLUJO.SOLICITAR_FECHA:
    case ESTADOS_FLUJO.DISPONIBILIDAD:
      return manejarFecha(conversacion, entrada, seleccion);
    case ESTADOS_FLUJO.SOLICITAR_HORA:
      return manejarHora(conversacion, entrada, seleccion);
    case ESTADOS_FLUJO.SOLICITAR_DESCRIPCION:
      return manejarDescripcion(conversacion, paciente, mensaje?.contenido || entrada);
    case ESTADOS_FLUJO.CREAR_SOLICITUD:
      return manejarCrearSolicitud(conversacion, paciente, mensaje);
    case ESTADOS_FLUJO.CONFIRMAR:
      return manejarConfirmacion(conversacion, paciente, entrada, seleccion);
    case ESTADOS_FLUJO.CANCELAR_CITA:
    case ESTADOS_FLUJO.REPROGRAMAR_CITA:
      return manejarCitaGestion(conversacion, paciente, entrada, seleccion);
    case ESTADOS_FLUJO.REPROGRAMAR_FECHA:
      return manejarReprogramarFecha(conversacion, entrada, seleccion);
    case ESTADOS_FLUJO.REPROGRAMAR_HORA:
      return manejarReprogramarHora(conversacion, paciente, entrada, seleccion);
    case ESTADOS_FLUJO.ACTUALIZAR_NOMBRE:
    case ESTADOS_FLUJO.ACTUALIZAR_APELLIDO:
    case ESTADOS_FLUJO.ACTUALIZAR_CORREO:
      return manejarActualizacionDatos(conversacion, paciente, conversacion.estadoFlujo, mensaje?.contenido || entrada);
    default:
      return mostrarMenu(conversacion, { saludo: false });
  }
  return mostrarMenu(conversacion, { saludo: false });
};

const abrirMenu = async (conversacion, opciones = {}) => mostrarMenu(conversacion, opciones);

module.exports = {
  ESTADOS: ESTADOS_FLUJO,
  abrirMenu,
  calcularFranjasDelDia,
  procesar,
  sumarDias
};
