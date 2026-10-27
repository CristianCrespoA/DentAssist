import { api } from './api';

const construirQuery = (parametros) => {
  const query = new URLSearchParams();

  Object.entries(parametros).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    query.set(clave, String(valor));
  });

  const texto = query.toString();
  return texto ? `?${texto}` : '';
};

export const listarSolicitudes = (
  { estado = '', tipo = '', pacienteId = '', fecha = '', pagina = 1, limite = 20 } = {},
  opciones,
) =>
  api.get(
    `/solicitudes${construirQuery({
      estado,
      tipo,
      pacienteId,
      fecha,
      pagina,
      limite,
    })}`,
    opciones,
  );

export const obtenerSolicitud = (id, opciones) =>
  api.get(`/solicitudes/${encodeURIComponent(id)}`, opciones);

export const cambiarEstadoSolicitud = (id, datos) =>
  api.put(`/solicitudes/${encodeURIComponent(id)}/estado`, datos);

/**
 * Cuenta las solicitudes por estado con los filtros activos. Son cuatro
 * peticiones de `limite=1` para aprovechar el `total` del listado paginado
 * sin necesitar un endpoint de métricas.
 */
export const contarSolicitudes = async (
  { tipo = '', pacienteId = '', fecha = '' } = {},
  opciones,
) => {
  const base = { tipo, pacienteId, fecha, pagina: 1, limite: 1 };

  const [pendiente, enAtencion, resuelta, todas] = await Promise.all([
    listarSolicitudes({ ...base, estado: 'pendiente' }, opciones),
    listarSolicitudes({ ...base, estado: 'en_atencion' }, opciones),
    listarSolicitudes({ ...base, estado: 'resuelta' }, opciones),
    listarSolicitudes(base, opciones),
  ]);

  return {
    pendiente: Number(pendiente?.total) || 0,
    en_atencion: Number(enAtencion?.total) || 0,
    resuelta: Number(resuelta?.total) || 0,
    todas: Number(todas?.total) || 0,
  };
};
