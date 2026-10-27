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

export const obtenerDisponibilidad = (
  { fecha, profesionalId, servicioId },
  opciones,
) =>
  api.get(
    `/disponibilidad${construirQuery({ fecha, profesionalId, servicioId })}`,
    opciones,
  );
