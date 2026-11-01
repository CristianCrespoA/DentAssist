const fs = require('fs');
const path = 'backend/src/services/solicitudService.js';
let c = fs.readFileSync(path, 'utf8');
const start = c.indexOf('const conversacionDeSolicitud');
const end = c.indexOf('const cambiarEstadoSolicitud');
if (start === -1 || end === -1) {
  console.log('no');
  process.exit(1);
}
const newBlock = `const conversacionDeSolicitud = async (solicitud) => {
  if (!solicitud) return null;

  if (solicitud.conversacion && solicitud.conversacion.id) {
    return solicitud.conversacion;
  }

  if (solicitud.conversacionId) {
    try {
      const c = await db.Conversacion.findByPk(solicitud.conversacionId);
      if (c) return c;
    } catch (e) {}
  }

  if (!solicitud.pacienteId) return null;

  try {
    return await db.Conversacion.findOne({
      where: { pacienteId: solicitud.pacienteId },
      order: [['ultimaActividad', 'DESC'], ['id', 'DESC']]
    });
  } catch (e) {
    return null;
  }
};

/**
 * Avisa al paciente que su solicitud fue resuelta.
 */
const notificarResolucion = async (solicitud) => {
  try {
    let s = solicitud || null;

    if (s && s.id) {
      if (!s.conversacionId || !s.pacienteId) {
        try {
          const full = await db.Solicitud.findByPk(s.id);
          if (full) {
            const plain = full.get ? full.get({ plain: true }) : full;
            s = { ...plain, ...s };
          }
        } catch (e) {}
      }
    }

    if (!s) return null;

    let conversacion = await conversacionDeSolicitud(s);

    if (!conversacion && s.pacienteId) {
      try {
        conversacion = await db.Conversacion.findOne({
          where: { pacienteId: s.pacienteId },
          order: [['ultimaActividad', 'DESC'], ['id', 'DESC']]
        });
      } catch (e) {}
    }

    if (!conversacion && s.conversacionId) {
      try {
        conversacion = await db.Conversacion.findByPk(s.conversacionId);
      } catch (e) {}
    }

    if (!conversacion) {
      registrar('resolucion_sin_conversacion', { solicitudId: s.id });
      return null;
    }

    const contenido = \`Tu solicitud #\${s.id} se resolvió.\`;
    const mensaje = await whatsappSalientes.enviarYGuardar({
      conversacion,
      contenido,
      textoPlano: contenido
    });

    registrar('resolucion_notificada', {
      solicitudId: s.id,
      mensajeId: mensaje?.id,
      estado: mensaje?.estado
    });

    return mensaje;
  } catch (error) {
    registrarError('resolucion_notificacion', error, {
      solicitudId: solicitud?.id
    });

    return null;
  }
};

`;
c = c.slice(0, start) + newBlock + c.slice(end);
fs.writeFileSync(path, c);
console.log('ok');
