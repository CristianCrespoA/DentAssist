const { verificarToken } = require('../utils/jwt');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ mensaje: 'Formato de token inválido' });
    }

    const token = parts[1];
    const decoded = verificarToken(token);

    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

const roleMiddleware = (roles = []) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No autorizado' });
    }

    if (roles.length && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'Acceso denegado: permisos insuficientes' });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  roleMiddleware
};