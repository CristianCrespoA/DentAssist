const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const {
  VENTANA_SERVICIO_MS,
  esSimuladorHabilitado
} = require('../config/whatsapp');
const { errorNegocio } = require('../utils/errores');
const { normalizarTelefonoDigitos, esTelefonoNormalizado } = require('../utils/telefono');
const { registrar, registrarError } = require('../utils/registroWhatsapp');
const {
  ESTADOS_FLUJO,
  MAPEO_ESTADOS_META,
  MENSAJE_PRIVACIDAD,
  MENSAJE_TIPO_NO_SOPORTADO,
  MOTIVO_VENTANA_CERRADA,
  RANGO_ESTADO,
  TIPOS_SOPORTADOS,
  extraerContenido,
  fechaDesdeTimestamp,
  mapearTipoMeta
} = require('../utils/whatsapp');
const whatsappApi = require('./whatsappApi');

const NOMBRE_CONTACTO_POR_DEFECTO = 'Contacto WhatsApp';
const NOMBRE_MAX = 100;
const CONTENIDO_MAX = 4096;

const normalizarNombrePerfil = (nombre) => {
  if (typeof nombre !== 'string') return '';

  return nombre.trim().replace(/\s+/g, ' ').slice(0, NOMBRE_MAX);
};

const motivoSeguro = (error) => {
  if (error?.codigo === 'sin_configuracion') return 'WhatsApp no está configurado';

  if (error?.status) return `La API de WhatsApp respondió ${error.status}`;

  return 'No se pudo enviar el mensaje por WhatsApp';
};

const buscarPorWaMessageId = (waMessageId) =>
  db.Mensaje.findOne({ where: { waMessageId } });

const buscarPaciente = async (telefono) => {
  const paciente = await db.Paciente.findOne({
    where: {
      [Op.or]: [{ telefonoNormalizado: telefono }, { telefono }]
    }
  });

  if (!paciente || paciente.telefonoNormalizado) return paciente;

  // Pacientes anteriores a la columna normalizada: se completa sin romper el
  // webhook si otro registro ya la tiene (el teléfono es único).
  try {
    await paciente.update({ telefonoNormalizado: telefono });
  } catch (error) {
    registrarError('paciente_normalizacion', error, { pacienteId: paciente.id });
  }

  return paciente;
};

const crearPacienteWhatsapp = async (telefono, nombrePerfil) => {
  const nombre = normalizarNombrePerfil(nombrePerfil) || NOMBRE_CONTACTO_POR_DEFECTO;

  try {
    return await db.Paciente.create({
      nombre,
      apellido: '',
      telefono,
      telefonoNormalizado: telefono,
      origen: 'whatsapp'
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return buscarPaciente(telefono);
    }

    throw error;
  }
};

const asegurarConversacion = async ({ telefono, pacienteId, nombrePerfil }) => {
  const contexto = normalizarNombrePerfil(nombrePerfil)
    ? { nombrePerfil: normalizarNombrePerfil(nombrePerfil) }
    : {};

  const [conversacion, creada] = await db.Conversacion.findOrCreate({
    where: { telefono },
    defaults: {
      pacienteId,
      estadoFlujo: ESTADOS_FLUJO.INICIAL,
      contexto,
      ultimaActividad: new Date()
    }
  });

  if (!creada) {
    const cambios = { ultimaActividad: new Date() };

    if (!conversacion.pacienteId) cambios.pacienteId = pacienteId;

    await conversacion.update(cambios);
  }

  return { conversacion, creada };
};

const crearEntrante = async ({
  conversacion,
  waMessageId,
  tipo,
  contenido,
  ocurridoEn,
  payload
}) => {
  try {
    return await db.Mensaje.create({
      conversacionId: conversacion.id,
      waMessageId,
      direccion: 'entrante',
      tipo,
      contenido: contenido || null,
      payload: payload ?? null,
      estado: 'recibido',
      ocurridoEn
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return null;

    throw error;
  }
};

const ventanaAbierta = async (conversacion) => {
  const ultimoEntrante = await db.Mensaje.findOne({
    where: { conversacionId: conversacion.id, direccion: 'entrante' },
    order: [['ocurridoEn', 'DESC'], ['id', 'DESC']]
  });

  if (!ultimoEntrante?.ocurridoEn) return false;

  const fecha = new Date(ultimoEntrante.ocurridoEn).getTime();

  if (Number.isNaN(fecha)) return false;

  return Date.now() - fecha <= VENTANA_SERVICIO_MS;
};

/**
 * Envía un mensaje saliente y lo persiste con su estado. Si la ventana de 24 h
 * está cerrada no llama a Meta: registra el mensaje como fallido y que requiere
 * plantilla. En modo simulado no se hace la petición HTTP.
 */
const enviarYGuardar = async ({
  conversacion,
  contenido,
  textoPlano,
  tipo = 'texto',
  simulado = false
}) => {
  const ahora = new Date();
  const abierta = await ventanaAbierta(conversacion);

  if (!abierta) {
    const mensaje = await db.Mensaje.create({
      conversacionId: conversacion.id,
      direccion: 'saliente',
      tipo,
      contenido: textoPlano ?? null,
      estado: 'fallido',
      ocurridoEn: ahora,
      estadoActualizadoEn: ahora,
      motivoFallo: MOTIVO_VENTANA_CERRADA,
      requierePlantilla: true
    });

    registrar('envio_requiere_plantilla', {
      conversacionId: conversacion.id,
      mensajeId: mensaje.id
    });

    return mensaje;
  }

  let resultado;

  try {
    resultado = simulado
      ? { waMessageId: `simulado-saliente-${randomUUID()}` }
      : await whatsappApi.enviarMensaje(conversacion.telefono, contenido);
  } catch (error) {
    const mensaje = await db.Mensaje.create({
      conversacionId: conversacion.id,
      direccion: 'saliente',
      tipo,
      contenido: textoPlano ?? null,
      estado: 'fallido',
      ocurridoEn: ahora,
      estadoActualizadoEn: ahora,
      motivoFallo: motivoSeguro(error)
    });

    registrarError('envio_fallido', error, {
      conversacionId: conversacion.id,
      mensajeId: mensaje.id
    });

    return mensaje;
  }

  const mensaje = await db.Mensaje.create({
    conversacionId: conversacion.id,
    waMessageId: resultado?.waMessageId ?? null,
    direccion: 'saliente',
    tipo,
    contenido: textoPlano ?? null,
    estado: 'enviado',
    ocurridoEn: ahora,
    estadoActualizadoEn: ahora
  });

  await conversacion.update({ ultimaActividad: ahora });

  return mensaje;
};

const enviarAvisoPrivacidad = async (conversacion, { simulado }) => {
  const mensaje = await enviarYGuardar({
    conversacion,
    contenido: MENSAJE_PRIVACIDAD,
    textoPlano: MENSAJE_PRIVACIDAD,
    simulado
  });

  if (mensaje.estado !== 'fallido') {
    // La aceptación es implícita: el aviso se entrega antes de cualquier flujo
    // y el paciente continúa la conversación. Queda registrada la fecha/hora.
    await conversacion.update({
      consentimientoAceptadoEn: mensaje.ocurridoEn ?? new Date(),
      estadoFlujo: ESTADOS_FLUJO.AVISO_ENVIADO
    });
  }

  return mensaje;
};

/**
 * Procesa un mensaje entrante completo: paciente, conversación, idempotencia,
 * aviso de privacidad y respuesta a tipos no soportados.
 */
const procesarMensajeEntrante = async (datos, opciones = {}) => {
  const { simulado = false } = opciones;
  const telefono = normalizarTelefonoDigitos(datos?.telefono);

  if (!esTelefonoNormalizado(telefono)) {
    throw errorNegocio('El teléfono del remitente no es válido');
  }

  const waMessageId = typeof datos?.waMessageId === 'string' ? datos.waMessageId.trim() : '';

  if (!waMessageId) {
    throw errorNegocio('El mensaje entrante no tiene identificador');
  }

  // Idempotencia: Meta reintenta el webhook si no recibe un 200 a tiempo.
  const existente = await buscarPorWaMessageId(waMessageId);

  if (existente) {
    registrar('mensaje_duplicado', { mensajeId: existente.id });

    return {
      duplicado: true,
      conversacion: null,
      paciente: null,
      mensaje: existente,
      respuestas: []
    };
  }

  const paciente =
    (await buscarPaciente(telefono)) ||
    (await crearPacienteWhatsapp(telefono, datos?.nombrePerfil));

  const { conversacion } = await asegurarConversacion({
    telefono,
    pacienteId: paciente.id,
    nombrePerfil: datos?.nombrePerfil
  });

  const mensaje = await crearEntrante({
    conversacion,
    waMessageId,
    tipo: datos?.tipo || 'texto',
    contenido: datos?.contenido,
    ocurridoEn: datos?.ocurridoEn || new Date(),
    payload: datos?.payload
  });

  if (!mensaje) {
    const previo = await buscarPorWaMessageId(waMessageId);
    registrar('mensaje_duplicado', { mensajeId: previo?.id });

    return {
      duplicado: true,
      conversacion,
      paciente,
      mensaje: previo,
      respuestas: []
    };
  }

  await conversacion.update({ ultimaActividad: new Date() });

  const respuestas = [];

  if (!conversacion.consentimientoAceptadoEn) {
    respuestas.push(await enviarAvisoPrivacidad(conversacion, { simulado }));
  }

  if (!TIPOS_SOPORTADOS.includes(mensaje.tipo)) {
    respuestas.push(
      await enviarYGuardar({
        conversacion,
        contenido: MENSAJE_TIPO_NO_SOPORTADO,
        textoPlano: MENSAJE_TIPO_NO_SOPORTADO,
        simulado
      })
    );
  }

  return {
    duplicado: false,
    conversacion,
    paciente,
    mensaje,
    respuestas
  };
};

/**
 * Actualiza el estado de un mensaje saliente a partir de un evento `statuses`
 * de Meta. Los eventos desordenados no hacen retroceder el estado.
 */
const procesarEstado = async (estadoMeta) => {
  const waMessageId = estadoMeta?.id;
  const estado = MAPEO_ESTADOS_META[estadoMeta?.status];

  if (!waMessageId || !estado) return { ignorado: true };

  const mensaje = await db.Mensaje.findOne({
    where: { waMessageId, direccion: 'saliente' }
  });

  if (!mensaje) return { ignorado: true };

  const rangoActual = RANGO_ESTADO[mensaje.estado] ?? 0;
  const rangoNuevo = RANGO_ESTADO[estado] ?? 0;

  if (estado !== 'fallido' && rangoNuevo < rangoActual) {
    return { ignorado: true, mensaje };
  }

  if (mensaje.estado === estado) return { mensaje };

  const ocurridoEn = fechaDesdeTimestamp(estadoMeta.timestamp) ?? new Date();
  const cambios = { estado, estadoActualizadoEn: ocurridoEn };

  if (estado === 'fallido') {
    const codigo = estadoMeta.errors?.[0]?.code;
    cambios.motivoFallo = codigo
      ? `La entrega falló (código ${codigo})`
      : 'La entrega falló';
  }

  await mensaje.update(cambios);

  registrar('estado_actualizado', { mensajeId: mensaje.id, estado });

  return { mensaje };
};

const procesarEventoWebhook = async (payload, opciones = {}) => {
  const resumen = { mensajes: 0, duplicados: 0, estados: 0, errores: 0 };

  if (!payload || payload.object !== 'whatsapp_business_account') return resumen;
  if (!Array.isArray(payload.entry)) return resumen;

  for (const entrada of payload.entry) {
    const cambios = Array.isArray(entrada?.changes) ? entrada.changes : [];

    for (const cambio of cambios) {
      const valor = cambio?.value || {};
      const perfiles = new Map(
        (Array.isArray(valor.contacts) ? valor.contacts : []).map((contacto) => [
          String(contacto?.wa_id),
          contacto?.profile?.name
        ])
      );

      for (const mensajeMeta of Array.isArray(valor.messages) ? valor.messages : []) {
        try {
          const resultado = await procesarMensajeEntrante(
            {
              telefono: mensajeMeta.from,
              waMessageId: mensajeMeta.id,
              tipo: mapearTipoMeta(mensajeMeta.type),
              contenido: extraerContenido(mensajeMeta),
              ocurridoEn: fechaDesdeTimestamp(mensajeMeta.timestamp) ?? new Date(),
              nombrePerfil: perfiles.get(String(mensajeMeta.from)) ?? null,
              payload: mensajeMeta
            },
            opciones
          );

          resumen.mensajes += 1;
          if (resultado.duplicado) resumen.duplicados += 1;
        } catch (error) {
          resumen.errores += 1;
          registrarError('mensaje_error', error);
        }
      }

      for (const estadoMeta of Array.isArray(valor.statuses) ? valor.statuses : []) {
        try {
          await procesarEstado(estadoMeta);
          resumen.estados += 1;
        } catch (error) {
          resumen.errores += 1;
          registrarError('estado_error', error);
        }
      }
    }
  }

  return resumen;
};

const normalizarTextoSimulado = (texto) => {
  if (typeof texto !== 'string') return null;

  const limpio = texto.trim();

  return limpio ? limpio.slice(0, CONTENIDO_MAX) : null;
};

const normalizarBotonSimulado = (boton) => {
  if (typeof boton === 'string' && boton.trim()) {
    return boton.trim().slice(0, 200);
  }

  if (boton && typeof boton === 'object') {
    const etiqueta = boton.titulo || boton.title || boton.id;

    if (typeof etiqueta === 'string' && etiqueta.trim()) {
      return etiqueta.trim().slice(0, 200);
    }
  }

  return null;
};

/**
 * Inyecta un mensaje entrante por el mismo pipeline, sin firma de Meta y sin
 * llamar a la Graph API. Solo disponible fuera de producción o con
 * WHATSAPP_SIMULADOR=1.
 */
const simularMensajeEntrante = async ({ telefono, texto, boton } = {}) => {
  if (!esSimuladorHabilitado()) {
    throw errorNegocio('El simulador no está habilitado', 404);
  }

  const telefonoNormalizado = normalizarTelefonoDigitos(telefono);

  if (!esTelefonoNormalizado(telefonoNormalizado)) {
    throw errorNegocio('El teléfono debe contener entre 7 y 15 dígitos');
  }

  const textoNormalizado = normalizarTextoSimulado(texto);
  const botonNormalizado = normalizarBotonSimulado(boton);

  if (!textoNormalizado && !botonNormalizado) {
    throw errorNegocio('Debes enviar un texto o un botón');
  }

  const tipo = botonNormalizado ? 'boton' : 'texto';
  const contenido = botonNormalizado || textoNormalizado;

  const resultado = await procesarMensajeEntrante(
    {
      telefono: telefonoNormalizado,
      waMessageId: `simulado-entrante-${randomUUID()}`,
      tipo,
      contenido,
      ocurridoEn: new Date(),
      nombrePerfil: 'Simulador local',
      payload: { simulado: true, tipo, contenido }
    },
    { simulado: true }
  );

  return {
    conversacionId: resultado.conversacion?.id ?? null,
    mensajeId: resultado.mensaje?.id ?? null,
    duplicado: Boolean(resultado.duplicado),
    respuestas: (resultado.respuestas || []).map((mensaje) => ({
      id: mensaje.id,
      direccion: mensaje.direccion,
      tipo: mensaje.tipo,
      contenido: mensaje.contenido,
      estado: mensaje.estado,
      requierePlantilla: Boolean(mensaje.requierePlantilla),
      motivo: mensaje.motivoFallo ?? null
    }))
  };
};

module.exports = {
  procesarEstado,
  procesarEventoWebhook,
  procesarMensajeEntrante,
  simularMensajeEntrante
};
