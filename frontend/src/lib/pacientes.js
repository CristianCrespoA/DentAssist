export const LIMITE_PACIENTES = 20;

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const NOMBRE_MAX = 100;
const CORREO_MAX = 255;
const DIRECCION_MAX = 255;
const TELEFONO_MIN = 7;
const TELEFONO_MAX = 15;

const dosDigitos = (valor) => String(valor).padStart(2, '0');

export const colapsarEspacios = (valor = '') =>
  String(valor).trim().replace(/\s+/g, ' ');

export const soloDigitos = (valor = '') => String(valor).replace(/\D/g, '');

export const nombreCompleto = (paciente) =>
  colapsarEspacios(`${paciente?.nombre ?? ''} ${paciente?.apellido ?? ''}`);

export const telefonoParaEditar = (telefono) => {
  const digitos = soloDigitos(telefono);

  // Los teléfonos colombianos se guardan con el indicativo 57.
  if (digitos.length === 12 && digitos.startsWith('57')) {
    return digitos.slice(2);
  }

  return digitos;
};

export const formatearTelefono = (telefono) => {
  const digitos = soloDigitos(telefono);

  if (!digitos) return '—';

  if (digitos.length === 12 && digitos.startsWith('57')) {
    return `+57 ${digitos.slice(2, 5)} ${digitos.slice(5, 8)} ${digitos.slice(8)}`;
  }

  if (digitos.length === 10) {
    return `${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}`;
  }

  return digitos;
};

export const hrefTelefono = (telefono) => {
  const digitos = soloDigitos(telefono);

  if (!digitos) return null;

  return digitos.startsWith('57') ? `tel:+${digitos}` : `tel:${digitos}`;
};

const fechaEsValida = (valor) => {
  if (!PATRON_FECHA.test(valor)) return false;

  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
};

export const hoyLocalISO = () => {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(
    ahora.getDate(),
  )}`;
};

export const formatearFecha = (valor, { larga = false } = {}) => {
  if (!valor) return '—';

  const fechaTexto = String(valor).slice(0, 10);

  if (!fechaEsValida(fechaTexto)) return fechaTexto;

  const [anio, mes, dia] = fechaTexto.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return new Intl.DateTimeFormat(
    'es-CO',
    larga
      ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' },
  ).format(fecha);
};

export const valoresInicialesPaciente = (paciente) => ({
  nombre: paciente?.nombre ?? '',
  apellido: paciente?.apellido ?? '',
  telefono: paciente ? telefonoParaEditar(paciente.telefono) : '',
  correo: paciente?.correo ?? '',
  fechaNacimiento: paciente?.fechaNacimiento
    ? String(paciente.fechaNacimiento).slice(0, 10)
    : '',
  direccion: paciente?.direccion ?? '',
});

export const validarPaciente = (valores) => {
  const errores = {};

  const nombre = colapsarEspacios(valores.nombre);
  if (!nombre) {
    errores.nombre = 'El nombre es obligatorio.';
  } else if (nombre.length > NOMBRE_MAX) {
    errores.nombre = `El nombre no puede superar los ${NOMBRE_MAX} caracteres.`;
  }

  const apellido = colapsarEspacios(valores.apellido);
  if (!apellido) {
    errores.apellido = 'El apellido es obligatorio.';
  } else if (apellido.length > NOMBRE_MAX) {
    errores.apellido = `El apellido no puede superar los ${NOMBRE_MAX} caracteres.`;
  }

  const digitos = soloDigitos(valores.telefono);
  if (!digitos) {
    errores.telefono = 'El teléfono es obligatorio.';
  } else if (digitos.length < TELEFONO_MIN || digitos.length > TELEFONO_MAX) {
    errores.telefono = `El teléfono debe contener entre ${TELEFONO_MIN} y ${TELEFONO_MAX} dígitos.`;
  }

  const correo = valores.correo.trim();
  if (correo.length > CORREO_MAX) {
    errores.correo = `El correo no puede superar los ${CORREO_MAX} caracteres.`;
  } else if (correo && !PATRON_CORREO.test(correo)) {
    errores.correo = 'El correo no tiene un formato válido.';
  }

  const fechaNacimiento = valores.fechaNacimiento.trim();
  if (fechaNacimiento) {
    if (!fechaEsValida(fechaNacimiento)) {
      errores.fechaNacimiento = 'La fecha de nacimiento no es válida.';
    } else if (fechaNacimiento > hoyLocalISO()) {
      errores.fechaNacimiento = 'La fecha de nacimiento no puede ser futura.';
    }
  }

  const direccion = colapsarEspacios(valores.direccion);
  if (direccion.length > DIRECCION_MAX) {
    errores.direccion = `La dirección no puede superar los ${DIRECCION_MAX} caracteres.`;
  }

  return errores;
};

export const aPayloadPaciente = (valores) => {
  const correo = valores.correo.trim().toLowerCase();
  const fechaNacimiento = valores.fechaNacimiento.trim();
  const direccion = colapsarEspacios(valores.direccion);

  return {
    nombre: colapsarEspacios(valores.nombre),
    apellido: colapsarEspacios(valores.apellido),
    telefono: soloDigitos(valores.telefono),
    correo: correo || null,
    fechaNacimiento: fechaNacimiento || null,
    direccion: direccion || null,
  };
};

const CAMPOS_POR_MENSAJE = [
  ['fechaNacimiento', /fecha de nacimiento/i],
  ['telefono', /tel[eé]fono/i],
  ['correo', /correo/i],
  ['apellido', /apellido/i],
  ['nombre', /nombre/i],
  ['direccion', /direcci[oó]n/i],
];

/**
 * Traduce el mensaje plano del backend al campo que lo originó.
 * La API del PR 1 devuelve `{ mensaje }`, sin detalle por campo.
 */
export const mapearErrorPaciente = (mensaje = '') => {
  const texto = String(mensaje).trim();

  if (!texto) {
    return {
      errores: {},
      general: 'No se pudo guardar el paciente. Inténtalo de nuevo.',
    };
  }

  if (/ese tel[eé]fono o correo/i.test(texto)) {
    return { errores: { telefono: texto, correo: texto }, general: '' };
  }

  const encontrado = CAMPOS_POR_MENSAJE.find(([, patron]) => patron.test(texto));

  if (encontrado) {
    return { errores: { [encontrado[0]]: texto }, general: '' };
  }

  return { errores: {}, general: texto };
};
