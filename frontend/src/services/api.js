const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '');

export const EVENTO_SESION_EXPIRADA = 'dentassist:sesion-expirada';

const MENSAJES_POR_ESTADO = {
  400: 'Revisa los datos enviados e inténtalo de nuevo.',
  401: 'Tu sesión expiró. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación entra en conflicto con otros datos existentes.',
  422: 'Los datos enviados no son válidos.',
  500: 'Ocurrió un error en el servidor. Inténtalo de nuevo.',
};

/**
 * Error normalizado de la API: siempre expone `mensaje` y `status`.
 */
export class ApiError extends Error {
  constructor(mensaje, status = 0, datos = null) {
    super(mensaje);
    this.name = 'ApiError';
    this.mensaje = mensaje;
    this.status = status;
    this.datos = datos;
  }
}

const limpiarSesion = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
};

const construirUrl = (ruta) => {
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `${API_URL}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
};

const leerCuerpo = async (respuesta) => {
  if (respuesta.status === 204) return null;

  const texto = await respuesta.text();
  if (!texto) return null;

  try {
    return JSON.parse(texto);
  } catch {
    return { mensaje: texto };
  }
};

async function solicitar(ruta, { method = 'GET', body, headers, signal } = {}) {
  const token = localStorage.getItem('token');
  const cabeceras = { Accept: 'application/json', ...headers };
  const opciones = { method, headers: cabeceras, signal };

  if (body !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    opciones.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (token) {
    cabeceras.Authorization = `Bearer ${token}`;
  }

  let respuesta;

  try {
    respuesta = await fetch(construirUrl(ruta), opciones);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(
      'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.',
      0,
    );
  }

  const datos = await leerCuerpo(respuesta);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) {
      const sesionVigente = Boolean(localStorage.getItem('token'));
      limpiarSesion();

      if (sesionVigente) {
        window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
      }
    }

    const mensaje =
      datos?.mensaje ||
      MENSAJES_POR_ESTADO[respuesta.status] ||
      'Ocurrió un error inesperado. Inténtalo de nuevo.';

    throw new ApiError(mensaje, respuesta.status, datos);
  }

  return datos;
}

export const api = {
  get: (ruta, opciones) => solicitar(ruta, { ...opciones, method: 'GET' }),
  post: (ruta, body, opciones) => solicitar(ruta, { ...opciones, method: 'POST', body }),
  put: (ruta, body, opciones) => solicitar(ruta, { ...opciones, method: 'PUT', body }),
  patch: (ruta, body, opciones) => solicitar(ruta, { ...opciones, method: 'PATCH', body }),
  delete: (ruta, opciones) => solicitar(ruta, { ...opciones, method: 'DELETE' }),
};

export { API_URL };
