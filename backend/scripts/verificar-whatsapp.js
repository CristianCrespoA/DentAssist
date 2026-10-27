'use strict';

/**
 * Revisa lo último que llegó/salió por el canal de WhatsApp.
 *
 * Uso, desde backend/:
 *   node scripts/verificar-whatsapp.js
 *   node scripts/verificar-whatsapp.js 573001234567
 *
 * Es de solo lectura: no envía mensajes ni modifica datos.
 */
const db = require('../src/models');

const limite = 10;

const recortar = (texto, max = 70) => {
  if (!texto) return '';

  const limpio = String(texto).replace(/\s+/g, ' ').trim();

  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio;
};

const formatearFecha = (fecha) => {
  if (!fecha) return '-';

  return new Date(fecha).toLocaleString('es-CO');
};

const main = async () => {
  const telefono = process.argv[2];

  if (telefono && !/^\d{7,15}$/.test(telefono)) {
    console.error('El teléfono debe venir solo con dígitos, por ejemplo 573001234567');
    process.exitCode = 1;
    return;
  }

  const conversaciones = await db.Conversacion.findAll({
    where: telefono ? { telefono } : undefined,
    order: [['id', 'DESC']],
    limit: limite
  });

  if (!conversaciones.length) {
    console.log(
      telefono
        ? `No hay conversación para el teléfono ${telefono}.`
        : 'No hay conversaciones todavía. El webhook no ha procesado ningún mensaje.'
    );
    return;
  }

  for (const conversacion of conversaciones) {
    const mensajes = await db.Mensaje.findAll({
      where: { conversacionId: conversacion.id },
      order: [['id', 'DESC']],
      limit: 20
    });

    console.log('');
    console.log('='.repeat(78));
    console.log(
      `Conversación ${conversacion.id} · teléfono ${conversacion.telefono} · paciente ${conversacion.pacienteId ?? '-'}`
    );
    console.log(
      `estadoFlujo=${conversacion.estadoFlujo} · consentimiento=${formatearFecha(conversacion.consentimientoAceptadoEn)}`
    );
    console.log(`última actividad=${formatearFecha(conversacion.ultimaActividad)}`);
    console.log('-'.repeat(78));

    if (!mensajes.length) {
      console.log('Sin mensajes.');
      continue;
    }

    for (const mensaje of mensajes.reverse()) {
      const bandera =
        mensaje.direccion === 'entrante' ? '<< ENTRA' : '>> SALE ';
      const extra = mensaje.requierePlantilla ? ' · requierePlantilla' : '';
      const motivo = mensaje.motivoFallo ? ` · ${mensaje.motivoFallo}` : '';

      console.log(
        `${bandera} #${mensaje.id} ${mensaje.tipo} · ${mensaje.estado}${extra}${motivo}`
      );
      console.log(`          ${formatearFecha(mensaje.ocurridoEn)}`);
      console.log(`          ${recortar(mensaje.contenido) || '(sin texto)'}`);
      console.log(`          waMessageId=${mensaje.waMessageId ?? '-'}`);
    }
  }

  console.log('');
};

main()
  .catch((error) => {
    console.error('No se pudo consultar la base de datos:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.sequelize.close());
