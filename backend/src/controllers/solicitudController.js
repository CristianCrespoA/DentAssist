const solicitudService = require('../services/solicitudService');
const { manejarError, errorNegocio } = require('../utils/errores');
const db = require('../models');

const listar = async (req, res) => {
  try {
    const { estado, tipo, pacienteId, fecha, pagina, limite } = req.query;
    const resultado = await solicitudService.listarSolicitudes({
      estado,
      tipo,
      pacienteId,
      fecha,
      pagina,
      limite
    });
    return res.status(200).json(resultado);
  } catch (error) {
    return manejarError(res, error);
  }
};

const obtener = async (req, res) => {
  try {
    const solicitud = await db.Solicitud.findByPk(req.params.id);
    if (!solicitud) {
      throw errorNegocio('Solicitud no encontrada', 404);
    }
    const plain = solicitud.get ? solicitud.get({ plain: true }) : JSON.parse(JSON.stringify(solicitud));
    try { if (plain.pacienteId) { const p = await db.Paciente.findByPk(plain.pacienteId); plain.paciente = p ? (p.get?p.get({plain:true}):p) : null; } else plain.paciente=null; } catch(e){console.error(e.message);plain.paciente=null;}
    try { if (plain.servicioId) { const s = await db.Servicio.findByPk(plain.servicioId); plain.servicio = s ? (s.get?s.get({plain:true}):s) : null; } else plain.servicio=null; } catch(e){console.error(e.message);plain.servicio=null;}
    try { if (plain.citaId) { const c = await db.Cita.findByPk(plain.citaId); if(c){ const pc=c.get?c.get({plain:true}):c; try{if(pc.profesionalId){const pr=await db.Profesional.findByPk(pc.profesionalId); if(pr) pc.profesional=pr.get?pr.get({plain:true}):pr;}}catch(e2){console.error(e2.message);} plain.cita=pc;} else plain.cita=null; } else plain.cita=null; } catch(e){console.error(e.message);plain.cita=null;}
    try { if (plain.conversacionId) { const cv = await db.Conversacion.findByPk(plain.conversacionId); plain.conversacion=cv?(cv.get?cv.get({plain:true}):cv):null; if(plain.conversacion){ try{const ms=await db.Mensaje.findAll({where:{conversacionId:plain.conversacion.id},order:[['ocurridoEn','ASC'],['createdAt','ASC']]}); plain.conversacion.mensajes=ms.map(m=>m.get?m.get({plain:true}):m);}catch(e2){console.error(e2.message);plain.conversacion.mensajes=[];} } } else plain.conversacion=null; } catch(e){console.error(e.message);plain.conversacion=null;}
    try { const hist=await db.SolicitudHistorial.findAll({where:{solicitudId:plain.id},order:[['createdAt','ASC']]}); plain.historial=[]; for(const h of hist){ const ph=h.get?h.get({plain:true}):h; try{if(ph.usuarioId){const u=await db.Usuario.findByPk(ph.usuarioId,{attributes:['id','nombre','apellido','email','rol']}); if(u) ph.usuario=u.get?u.get({plain:true}):u;}}catch(e2){console.error(e2.message);} plain.historial.push(ph);} } catch(e){console.error(e.message);plain.historial=[];}
    return res.status(200).json(plain);
  } catch (error) {
    console.error('ERROR OBTENER SOLICITUD:', error);
    return manejarError(res, error);
  }
};

const cambiarEstado = async (req, res) => {
  try {
    const solicitud = await solicitudService.cambiarEstadoSolicitud(
      req.params.id,
      req.body,
      req.usuario
    );
    return res.status(200).json(solicitud);
  } catch (error) {
    return manejarError(res, error);
  }
};

module.exports = {
  listar,
  obtener,
  cambiarEstado
};
