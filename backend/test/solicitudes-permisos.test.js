const { test } = require('node:test');
const assert = require('node:assert/strict');
const { roleMiddleware } = require('../src/middlewares/authMiddleware');
const { ROLES_PERSONAL } = require('../src/utils/roles');
const { manejarError } = require('../src/utils/errores');

const crearRespuesta = () => {
  const res = {
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(cuerpo) {
      this.body = cuerpo;
      return this;
    }
  };

  return res;
};

test('solo el personal puede consultar y cambiar solicitudes', () => {
  const middleware = roleMiddleware(ROLES_PERSONAL);

  let siguiente = false;
  const resPaciente = crearRespuesta();

  middleware({ usuario: { rol: 'paciente' } }, resPaciente, () => {
    siguiente = true;
  });

  assert.equal(resPaciente.statusCode, 403);
  assert.equal(siguiente, false);

  siguiente = false;
  const resRecepcionista = crearRespuesta();

  middleware({ usuario: { rol: 'recepcionista' } }, resRecepcionista, () => {
    siguiente = true;
  });

  assert.equal(siguiente, true);
  assert.equal(resRecepcionista.statusCode, undefined);
});

test('sin usuario autenticado las solicitudes responden 401', () => {
  const middleware = roleMiddleware(ROLES_PERSONAL);

  let siguiente = false;
  const res = crearRespuesta();

  middleware({}, res, () => {
    siguiente = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(siguiente, false);
});

test('los 409 de reprogramación incluyen las alternativas en la respuesta', () => {
  const error = new Error('El profesional ya tiene una cita');
  error.statusCode = 409;
  error.alternativas = ['11:30', '15:00'];

  const res = crearRespuesta();

  manejarError(res, error);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    mensaje: 'El profesional ya tiene una cita',
    alternativas: ['11:30', '15:00']
  });
});
