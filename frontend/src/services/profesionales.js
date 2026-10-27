import { api } from './api';

export const listarProfesionales = (opciones) => api.get('/profesionales', opciones);
