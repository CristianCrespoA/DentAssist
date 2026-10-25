const ROLES_PERSONAL = ['admin', 'recepcionista'];

const esPersonal = (rol) => ROLES_PERSONAL.includes(rol);

module.exports = {
  ROLES_PERSONAL,
  esPersonal
};
