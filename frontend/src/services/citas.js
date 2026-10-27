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

export const listarCitas = (
  { fecha = '', pacienteId = '', profesionalId = '', estado = '' } = {},
  opciones,
) =>
  api.get(
    `/citas${construirQuery({ fecha, pacienteId, profesionalId, estado })}`,
    opciones,
  );

export const obtenerCita = (id, opciones) =>
  api.get(`/citas/${encodeURIComponent(id)}`, opciones);
