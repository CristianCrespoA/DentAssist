const fs = require('fs');
const path = 'backend/src/services/solicitudService.js';
let c = fs.readFileSync(path, 'utf8');
const old = `  const solicitud = await obtenerSolicitud(solicitudId);

  if (estadoNuevo === 'resuelta') {
    if (mensajeResolucionExtra) {
      try {
        if (solicitud && solicitud.origen === 'whatsapp') {
          const conversacion = await conversacionDeSolicitud(solicitud);
          if (conversacion) {
            await whatsappSalientes.enviarYGuardar({ conversacion, contenido: \`Tu solicitud #\${solicitud.id} se resolvió.\n\n\${mensajeResolucionExtra}\`, textoPlano: \`Tu solicitud #\${solicitud.id} se resolvió.\n\n\${mensajeResolucionExtra}\` });
          }
        }
      } catch (e) {}
    }
    await notificarResolucion(solicitud);
  }`;
const neu = `  const solicitud = await obtenerSolicitud(solicitudId);

  if (estadoNuevo === 'resuelta') {
    let sNotif = solicitud;
    try {
      if (sNotif && sNotif.id) {
        const full = await db.Solicitud.findByPk(sNotif.id);
        if (full) {
          const plain = full.get ? full.get({ plain: true }) : full;
          sNotif = { ...plain, ...(typeof sNotif === 'object' ? sNotif : {}), ...sNotif };
        }
      }
    } catch (e) {}

    try {
      let conversacion = await conversacionDeSolicitud(sNotif);
      if (!conversacion && sNotif?.pacienteId) {
        try { conversacion = await db.Conversacion.findOne({ where: { pacienteId: sNotif.pacienteId }, order: [['ultimaActividad', 'DESC'], ['id', 'DESC']] }); } catch (e) {}
      }
      if (!conversacion && sNotif?.conversacionId) {
        try { conversacion = await db.Conversacion.findByPk(sNotif.conversacionId); } catch (e) {}
      }
      if (conversacion) {
        if (mensajeResolucionExtra) {
          await whatsappSalientes.enviarYGuardar({ conversacion, contenido: \`Tu solicitud #\${sNotif.id} se resolvió.\n\nTipo: \${sNotif.tipo || ''}\n\nObservación: \${mensajeResolucionExtra}\`, textoPlano: \`Tu solicitud #\${sNotif.id} se resolvió.\n\nTipo: \${sNotif.tipo || ''}\n\nObservación: \${mensajeResolucionExtra}\` });
        } else {
          await whatsappSalientes.enviarYGuardar({ conversacion, contenido: \`Tu solicitud #\${sNotif.id} se resolvió.\n\nTipo: \${sNotif.tipo || ''}\`, textoPlano: \`Tu solicitud #\${sNotif.id} se resolvió.\n\nTipo: \${sNotif.tipo || ''}\` });
        }
      }
    } catch (e) {}
    await notificarResolucion(sNotif);
  }`;
if (c.indexOf(old) === -1) { console.log('nf'); process.exit(1); }
c = c.split(old).join(neu);
fs.writeFileSync(path, c);
console.log('ok');
