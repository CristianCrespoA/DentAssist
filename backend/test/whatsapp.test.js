const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/models');
const whatsappApi = require('../src/services/whatsappApi');
const whatsappService = require('../src/services/whatsappService');
const whatsappController = require('../src/controllers/whatsappController');
const { calcularFirma, firmaValida } = require('../src/utils/firmaWhatsapp');
const { limpiarDatos, registrar } = require('../src/utils/registroWhatsapp');
const {
  MAPEO_ESTADOS_META,
  MENSAJE_PRIVACIDAD,
  MENSAJE_TIPO_NO_SOPORTADO,
  MOTIVO_VENTANA_CERRADA
} = require('../src/utils/whatsapp');

const crearRespuesta = () => ({
  status(codigo) {
    this.statusCode = codigo;
    return this;
  },
  json(cuerpo) {
    this.body = cuerpo;
    return this;
  },
  type(tipo) {
    this.contentType = tipo;
    return this;
  },
  send(cuerpo) {
    this.sent = cuerpo;
    return this;
  }
});

const crearConversacion = (datos = {}) => ({
  id: 10,
  telefono: '573001234567',
  pacienteId: 5,
  estadoFlujo: 'inicial',
  contexto: {},
  consentimientoAceptadoEn: null,
  actualizaciones: [],
  async update(cambios) {
    Object.assign(this, cambios);
    this.actualizaciones.push(cambios);
  },
  ...datos
});

const PACIENTE_EXISTENTE = {
  id: 5,
  nombre: 'Ana',
  telefono: '573001234567',
  telefonoNormalizado: '573001234567'
};

/**
 * Deja db y la API de WhatsApp simuladas. El `db.Mensaje.findOne` distingue la
 * búsqueda por waMessageId (idempotencia) de la ventana de 24 h.
 */
const prepararPipeline = (
  t,
  {
    pacienteExistente = null,
    conversacion = null,
    creada = true,
    existente = null,
    ultimoEntrante = null
  } = {}
) => {
  const estado = {
    conversacion: conversacion ?? crearConversacion(),
    pacienteCreado: null,
    entrantes: [],
    salientes: [],
    siguienteMensajeId: 0
  };

  if (ultimoEntrante) estado.entrantes.push(ultimoEntrante);

  t.mock.method(db.Mensaje, 'findOne', async ({ where = {} } = {}) => {
    if (where.waMessageId) return existente;
    if (where.direccion === 'entrante') return estado.entrantes.at(-1) ?? null;
    return null;
  });

  t.mock.method(db.Mensaje, 'create', async (datos) => {
    estado.siguienteMensajeId += 1;
    const mensaje = { id: estado.siguienteMensajeId, ...datos };

    if (datos.direccion === 'entrante') estado.entrantes.push(mensaje);
    else estado.salientes.push(mensaje);

    return mensaje;
  });

  t.mock.method(db.Paciente, 'findOne', async () => pacienteExistente);
  t.mock.method(db.Paciente, 'create', async (datos) => {
    estado.pacienteCreado = { id: 77, ...datos };

    return estado.pacienteCreado;
  });

  t.mock.method(db.Conversacion, 'findOrCreate', async () => [estado.conversacion, creada]);

  return estado;
};

const observarApi = (
  t,
  implementacion = async () => ({ waMessageId: 'wamid.saliente' })
) => t.mock.method(whatsappApi, 'enviarMensaje', implementacion);

const conVariables = async (variables, callback) => {
  const anteriores = {};

  for (const [clave, valor] of Object.entries(variables)) {
    anteriores[clave] = process.env[clave];

    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }

  try {
    return await callback();
  } finally {
    for (const [clave, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
};

test('un mensaje entrante crea paciente y conversación, guarda y responde el aviso', async (t) => {
  const estado = prepararPipeline(t);
  const api = observarApi(t);

  const resultado = await whatsappService.procesarMensajeEntrante(
    {
      telefono: '300 123 4567',
      waMessageId: 'wamid.entrante-1',
      tipo: 'texto',
      contenido: 'Hola, quiero una cita',
      ocurridoEn: new Date(),
      nombrePerfil: '  Ana   Pérez  '
    },
    { simulado: true }
  );

  assert.equal(resultado.duplicado, false);
  assert.equal(estado.pacienteCreado.nombre, 'Ana Pérez');
  assert.equal(estado.pacienteCreado.apellido, '');
  assert.equal(estado.pacienteCreado.telefono, '573001234567');
  assert.equal(estado.pacienteCreado.telefonoNormalizado, '573001234567');
  assert.equal(estado.pacienteCreado.origen, 'whatsapp');

  assert.equal(estado.entrantes.length, 1);
  assert.equal(estado.entrantes[0].contenido, 'Hola, quiero una cita');
  assert.equal(estado.salientes.length, 1);
  assert.equal(resultado.respuestas.length, 1);
  assert.equal(resultado.respuestas[0].contenido, MENSAJE_PRIVACIDAD);
  assert.equal(resultado.respuestas[0].estado, 'enviado');
  assert.equal(resultado.respuestas[0].direccion, 'saliente');
  assert.ok(estado.conversacion.consentimientoAceptadoEn instanceof Date);
  assert.equal(estado.conversacion.estadoFlujo, 'aviso_enviado');
  assert.equal(api.mock.callCount(), 0);
});

test('reutiliza el paciente y la conversación y no repite el aviso', async (t) => {
  const conversacion = crearConversacion({ consentimientoAceptadoEn: new Date() });
  const estado = prepararPipeline(t, {
    pacienteExistente: PACIENTE_EXISTENTE,
    conversacion,
    creada: false
  });

  const resultado = await whatsappService.procesarMensajeEntrante(
    {
      telefono: '573001234567',
      waMessageId: 'wamid.entrante-2',
      tipo: 'texto',
      contenido: 'Sigo interesado',
      ocurridoEn: new Date()
    },
    { simulado: true }
  );

  assert.equal(estado.pacienteCreado, null);
  assert.equal(resultado.paciente, PACIENTE_EXISTENTE);
  assert.equal(resultado.respuestas.length, 0);
  assert.equal(estado.entrantes.length, 1);
  assert.equal(estado.salientes.length, 0);
  assert.equal(conversacion.actualizaciones.length, 2);
});

test('un waMessageId repetido se ignora y no genera respuestas', async (t) => {
  const existente = { id: 99, waMessageId: 'wamid.duplicado' };
  const estado = prepararPipeline(t, { existente });

  const resultado = await whatsappService.procesarMensajeEntrante(
    {
      telefono: '3001234567',
      waMessageId: 'wamid.duplicado',
      tipo: 'texto',
      contenido: 'Hola otra vez',
      ocurridoEn: new Date()
    },
    { simulado: true }
  );

  assert.equal(resultado.duplicado, true);
  assert.equal(resultado.mensaje, existente);
  assert.deepEqual(resultado.respuestas, []);
  assert.equal(estado.entrantes.length, 0);
  assert.equal(estado.salientes.length, 0);
  assert.equal(estado.pacienteCreado, null);
});

test('responde a tipos no soportados indicando que se atiende por texto o botones', async (t) => {
  const conversacion = crearConversacion({ consentimientoAceptadoEn: new Date() });
  const estado = prepararPipeline(t, {
    pacienteExistente: PACIENTE_EXISTENTE,
    conversacion,
    creada: false
  });

  const resultado = await whatsappService.procesarMensajeEntrante(
    {
      telefono: '573001234567',
      waMessageId: 'wamid.audio-1',
      tipo: 'audio',
      contenido: null,
      ocurridoEn: new Date(),
      payload: { type: 'audio' }
    },
    { simulado: true }
  );

  assert.equal(resultado.mensaje.tipo, 'audio');
  assert.equal(resultado.respuestas.length, 1);
  assert.equal(resultado.respuestas[0].contenido, MENSAJE_TIPO_NO_SOPORTADO);
  assert.equal(resultado.respuestas[0].estado, 'enviado');
  assert.equal(estado.salientes.length, 1);
});

test('con la ventana de 24 h cerrada no llama a Meta y marca que requiere plantilla', async (t) => {
  const conversacion = crearConversacion({ consentimientoAceptadoEn: new Date() });
  const estado = prepararPipeline(t, {
    pacienteExistente: PACIENTE_EXISTENTE,
    conversacion,
    creada: false
  });
  const api = observarApi(t);
  const hace25Horas = new Date(Date.now() - 25 * 60 * 60 * 1000);

  const resultado = await whatsappService.procesarMensajeEntrante(
    {
      telefono: '573001234567',
      waMessageId: 'wamid.viejo-1',
      tipo: 'audio',
      contenido: null,
      ocurridoEn: hace25Horas
    },
    { simulado: true }
  );

  assert.equal(resultado.respuestas.length, 1);
  assert.equal(resultado.respuestas[0].estado, 'fallido');
  assert.equal(resultado.respuestas[0].requierePlantilla, true);
  assert.equal(resultado.respuestas[0].motivoFallo, MOTIVO_VENTANA_CERRADA);
  assert.equal(api.mock.callCount(), 0);
});

test('guarda el fallo de envío sin incluir datos sensibles en el motivo', async (t) => {
  const conversacion = crearConversacion({ consentimientoAceptadoEn: null });
  prepararPipeline(t, {
    pacienteExistente: PACIENTE_EXISTENTE,
    conversacion,
    creada: false
  });

  const api = observarApi(t, async () => {
    throw new whatsappApi.ErrorEnvioWhatsapp('La API de WhatsApp respondió 500', {
      status: 500,
      codigo: 500
    });
  });

  const resultado = await whatsappService.procesarMensajeEntrante(
    {
      telefono: '573001234567',
      waMessageId: 'wamid.fallo-1',
      tipo: 'texto',
      contenido: 'Hola',
      ocurridoEn: new Date()
    }
  );

  assert.equal(resultado.respuestas.length, 1);
  assert.equal(resultado.respuestas[0].estado, 'fallido');
  assert.equal(resultado.respuestas[0].motivoFallo, 'La API de WhatsApp respondió 500');
  assert.doesNotMatch(resultado.respuestas[0].motivoFallo, /573001234567|Hola/);
  assert.equal(api.mock.callCount(), 1);
});

for (const [estadoMeta, estadoInterno] of Object.entries(MAPEO_ESTADOS_META)) {
  test(`actualiza el mensaje saliente al estado ${estadoInterno}`, async (t) => {
    const mensaje = {
      id: 31,
      waMessageId: 'wamid.saliente',
      direccion: 'saliente',
      estado: 'recibido',
      async update(cambios) {
        Object.assign(this, cambios);
      }
    };

    t.mock.method(db.Mensaje, 'findOne', async () => mensaje);

    const resultado = await whatsappService.procesarEstado({
      id: 'wamid.saliente',
      status: estadoMeta,
      timestamp: '1730000000',
      errors: estadoInterno === 'fallido' ? [{ code: 131047 }] : []
    });

    assert.equal(resultado.mensaje, mensaje);
    assert.equal(mensaje.estado, estadoInterno);
    assert.ok(mensaje.estadoActualizadoEn instanceof Date);

    if (estadoInterno === 'fallido') {
      assert.match(mensaje.motivoFallo, /131047/);
    }
  });
}

test('los estados desordenados no hacen retroceder el mensaje', async (t) => {
  const mensaje = {
    id: 32,
    waMessageId: 'wamid.saliente',
    direccion: 'saliente',
    estado: 'leido',
    async update() {
      throw new Error('No debería actualizarse');
    }
  };

  t.mock.method(db.Mensaje, 'findOne', async () => mensaje);

  const resultado = await whatsappService.procesarEstado({
    id: 'wamid.saliente',
    status: 'delivered',
    timestamp: '1730000000'
  });

  assert.equal(resultado.ignorado, true);
  assert.equal(mensaje.estado, 'leido');
});

test('ignora estados desconocidos y mensajes que no existen', async (t) => {
  t.mock.method(db.Mensaje, 'findOne', async () => null);

  assert.deepEqual(
    await whatsappService.procesarEstado({ id: 'wamid.x', status: 'deleted' }),
    { ignorado: true }
  );
  assert.deepEqual(
    await whatsappService.procesarEstado({ id: 'wamid.desconocido', status: 'read' }),
    { ignorado: true }
  );
});

test('procesarEventoWebhook ignora payloads que no son de WhatsApp', async () => {
  assert.deepEqual(await whatsappService.procesarEventoWebhook({ object: 'page' }), {
    mensajes: 0,
    duplicados: 0,
    estados: 0,
    errores: 0
  });

  assert.deepEqual(
    await whatsappService.procesarEventoWebhook({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {} }] }]
    }),
    { mensajes: 0, duplicados: 0, estados: 0, errores: 0 }
  );
});

test('el simulador inyecta un entrante por el mismo pipeline sin llamar a Meta', async (t) => {
  const estado = prepararPipeline(t);
  const api = observarApi(t);

  const resultado = await whatsappService.simularMensajeEntrante({
    telefono: '300 123 4567',
    texto: '  Quiero agendar  '
  });

  assert.equal(resultado.duplicado, false);
  assert.equal(resultado.conversacionId, 10);
  assert.equal(resultado.respuestas.length, 1);
  assert.equal(resultado.respuestas[0].contenido, MENSAJE_PRIVACIDAD);
  assert.equal(estado.entrantes[0].contenido, 'Quiero agendar');
  assert.equal(estado.entrantes[0].tipo, 'texto');
  assert.match(estado.entrantes[0].waMessageId, /^simulado-entrante-/);
  assert.equal(api.mock.callCount(), 0);
});

test('el simulador acepta botones y valida la entrada', async (t) => {
  const estado = prepararPipeline(t);

  const resultado = await whatsappService.simularMensajeEntrante({
    telefono: '3001234567',
    boton: 'Agendar cita'
  });

  assert.equal(resultado.respuestas.length, 1);
  assert.equal(estado.entrantes[0].tipo, 'boton');
  assert.equal(estado.entrantes[0].contenido, 'Agendar cita');

  await assert.rejects(
    whatsappService.simularMensajeEntrante({ telefono: 'abc', texto: 'Hola' }),
    (error) => error.statusCode === 400
  );
  await assert.rejects(
    whatsappService.simularMensajeEntrante({ telefono: '3001234567' }),
    (error) => error.statusCode === 400
  );
});

test('el simulador está bloqueado en producción sin la variable explícita', async () => {
  await conVariables(
    { NODE_ENV: 'production', WHATSAPP_SIMULADOR: undefined },
    async () => {
      await assert.rejects(
        whatsappService.simularMensajeEntrante({
          telefono: '3001234567',
          texto: 'Hola'
        }),
        (error) => error.statusCode === 404
      );
    }
  );
});

test('la verificación del webhook responde el challenge y rechaza tokens inválidos', async () => {
  await conVariables({ WHATSAPP_VERIFY_TOKEN: 'token-secreto' }, async () => {
    const res = crearRespuesta();
    whatsappController.verificar(
      {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'token-secreto',
          'hub.challenge': 'challenge-123'
        }
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.contentType, 'text/plain');
    assert.equal(res.sent, 'challenge-123');

    const resInvalido = crearRespuesta();
    whatsappController.verificar(
      {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'otro-token',
          'hub.challenge': 'challenge-123'
        }
      },
      resInvalido
    );
    assert.equal(resInvalido.statusCode, 403);

    const resModoInvalido = crearRespuesta();
    whatsappController.verificar(
      {
        query: {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'token-secreto',
          'hub.challenge': 'challenge-123'
        }
      },
      resModoInvalido
    );
    assert.equal(resModoInvalido.statusCode, 403);
  });
});

test('la firma HMAC SHA-256 se calcula sobre el cuerpo crudo', () => {
  const cuerpo = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
  const firma = calcularFirma(cuerpo, 'secreto');

  assert.equal(firmaValida(cuerpo, firma, 'secreto'), true);
  assert.equal(firmaValida(cuerpo, firma, 'otro-secreto'), false);
  assert.equal(firmaValida(Buffer.from('{}'), firma, 'secreto'), false);
  assert.equal(firmaValida(cuerpo, 'sha1=abc', 'secreto'), false);
  assert.equal(firmaValida(cuerpo, undefined, 'secreto'), false);
});

test('el webhook rechaza firmas inválidas sin procesar el evento', async (t) => {
  await conVariables({ WHATSAPP_APP_SECRET: 'secreto' }, async () => {
    t.mock.method(whatsappService, 'procesarEventoWebhook', async () => {
      throw new Error('No debería procesarse');
    });

    const res = crearRespuesta();
    whatsappController.recibir(
      {
        body: { object: 'whatsapp_business_account', entry: [] },
        cuerpoCrudo: Buffer.from('{"object":"whatsapp_business_account","entry":[]}'),
        get: () => 'sha256=00'
      },
      res
    );

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.mensaje, 'Firma inválida');
  });
});

test('el webhook responde 200 antes de procesar un evento firmado', async (t) => {
  await conVariables({ WHATSAPP_APP_SECRET: 'secreto' }, async () => {
    const payload = { object: 'whatsapp_business_account', entry: [] };
    const cuerpoCrudo = Buffer.from(JSON.stringify(payload));
    let procesado = null;

    t.mock.method(whatsappService, 'procesarEventoWebhook', async (datos) => {
      procesado = datos;

      return {};
    });

    const res = crearRespuesta();
    whatsappController.recibir(
      {
        body: payload,
        cuerpoCrudo,
        get: (nombre) =>
          nombre === 'x-hub-signature-256'
            ? calcularFirma(cuerpoCrudo, 'secreto')
            : undefined
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { recibido: true });
    assert.equal(procesado, null);

    await new Promise((resolver) => setImmediate(resolver));

    assert.equal(procesado, payload);
  });
});

test('el webhook responde 503 si no hay App Secret configurado', async () => {
  await conVariables({ WHATSAPP_APP_SECRET: undefined }, async () => {
    const res = crearRespuesta();
    whatsappController.recibir(
      {
        body: {},
        cuerpoCrudo: Buffer.from('{}'),
        get: () => 'sha256=00'
      },
      res
    );

    assert.equal(res.statusCode, 503);
  });
});

test('los logs de WhatsApp solo muestran identificadores internos', (t) => {
  const log = t.mock.method(console, 'log', () => {});

  registrar('mensaje_recibido', {
    telefono: '573001234567',
    nombre: 'Ana Pérez',
    contenido: 'Me duele una muela',
    payload: { texto: 'Me duele una muela' },
    conversacionId: 12,
    mensajeId: 34
  });

  const registrado = JSON.stringify(log.mock.calls);

  assert.match(registrado, /conversacionId/);
  assert.match(registrado, /mensajeId/);
  assert.doesNotMatch(registrado, /573001234567/);
  assert.doesNotMatch(registrado, /Ana/);
  assert.doesNotMatch(registrado, /duele/);
  assert.deepEqual(limpiarDatos({ telefono: '3001234567', nombre: 'Ana' }), {});
});

test('enviarMensaje reintenta con backoff y devuelve el waMessageId', async () => {
  await conVariables(
    {
      WHATSAPP_TOKEN: 'token',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_API_VERSION: 'v23.0'
    },
    async () => {
      let intentos = 0;
      const fetchImpl = async () => {
        intentos += 1;

        if (intentos < 3) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: { code: 500 } })
          };
        }

        return {
          ok: true,
          json: async () => ({ messages: [{ id: 'wamid.exitoso' }] })
        };
      };

      const resultado = await whatsappApi.enviarMensaje('3001234567', 'Hola', {
        fetchImpl,
        esperaBaseMs: 0
      });

      assert.deepEqual(resultado, { waMessageId: 'wamid.exitoso' });
      assert.equal(intentos, 3);
    }
  );
});

test('enviarMensaje no reintenta errores 4xx y no expone el teléfono', async () => {
  await conVariables(
    {
      WHATSAPP_TOKEN: 'token',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_API_VERSION: 'v23.0'
    },
    async () => {
      let intentos = 0;
      const fetchImpl = async () => {
        intentos += 1;

        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { code: 100 } })
        };
      };

      await assert.rejects(
        whatsappApi.enviarMensaje('3001234567', 'Hola', {
          fetchImpl,
          esperaBaseMs: 0
        }),
        (error) => {
          assert.equal(error.status, 400);
          assert.equal(error.codigo, 100);
          assert.doesNotMatch(error.message, /3001234567|Hola/);

          return true;
        }
      );

      assert.equal(intentos, 1);
    }
  );
});

test('enviarMensaje falla con un motivo seguro si no hay configuración', async () => {
  await conVariables(
    { WHATSAPP_TOKEN: undefined, WHATSAPP_PHONE_NUMBER_ID: undefined },
    async () => {
      await assert.rejects(
        whatsappApi.enviarMensaje('3001234567', 'Hola'),
        (error) => error.codigo === 'sin_configuracion'
      );
    }
  );
});

test('construirCuerpo arma mensajes de texto e interactivos', () => {
  assert.deepEqual(whatsappApi.construirCuerpo('300 123 4567', 'Hola'), {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '3001234567',
    type: 'text',
    text: { preview_url: false, body: 'Hola' }
  });

  assert.deepEqual(
    whatsappApi.construirCuerpo('573001234567', {
      tipo: 'interactivo',
      interactivo: {
        type: 'button',
        body: { text: '¿Confirmas tu cita?' },
        action: { buttons: [{ type: 'reply', reply: { id: 'si', title: 'Sí' } }] }
      }
    }),
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '573001234567',
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: '¿Confirmas tu cita?' },
        action: { buttons: [{ type: 'reply', reply: { id: 'si', title: 'Sí' } }] }
      }
    }
  );

  assert.throws(
    () => whatsappApi.construirCuerpo('', 'Hola'),
    /teléfono del destinatario/
  );
});

test('normaliza el teléfono de un paciente web antes de guardarlo', () => {
  const { normalizarTelefonoDigitos } = require('../src/utils/telefono');

  assert.equal(normalizarTelefonoDigitos('300 123 4567'), '573001234567');
  assert.equal(normalizarTelefonoDigitos('+57 300 123 4567'), '573001234567');
  assert.equal(normalizarTelefonoDigitos('0057 300 123 4567'), '573001234567');
  assert.equal(normalizarTelefonoDigitos('601 123 4567'), '576011234567');
  assert.equal(normalizarTelefonoDigitos('123'), '123');
  assert.equal(normalizarTelefonoDigitos(null), '');
});
