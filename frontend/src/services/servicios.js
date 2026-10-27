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

export const listarServicios = ({ buscar = '' } = {}, opciones) =>
  api.get(`/servicios${construirQuery({ buscar })}`, opciones);
