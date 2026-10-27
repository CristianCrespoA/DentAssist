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

export const listarPacientes = (
  { buscar = '', pagina = 1, limite = 20 } = {},
  opciones,
) =>
  api.get(
    `/pacientes${construirQuery({ buscar, pagina, limite })}`,
    opciones,
  );

export const obtenerPaciente = (id, opciones) =>
  api.get(`/pacientes/${encodeURIComponent(id)}`, opciones);

export const crearPaciente = (datos) => api.post('/pacientes', datos);

export const actualizarPaciente = (id, datos) =>
  api.put(`/pacientes/${encodeURIComponent(id)}`, datos);

export const eliminarPaciente = (id) =>
  api.delete(`/pacientes/${encodeURIComponent(id)}`);
