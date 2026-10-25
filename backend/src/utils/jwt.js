const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dentassist_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

const generarToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const verificarToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  generarToken,
  verificarToken
};