import { useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { EVENTO_SESION_EXPIRADA } from '../services/api';

/**
 * Avisa al usuario cuando el cliente API cierra la sesión por un 401.
 */
function SessionWatcher() {
  const { error } = useToast();

  useEffect(() => {
    const manejarSesionExpirada = () => {
      error('Tu sesión expiró. Inicia sesión nuevamente.', {
        titulo: 'Sesión finalizada',
        duracion: 8000,
      });
    };

    window.addEventListener(EVENTO_SESION_EXPIRADA, manejarSesionExpirada);

    return () =>
      window.removeEventListener(EVENTO_SESION_EXPIRADA, manejarSesionExpirada);
  }, [error]);

  return null;
}

export default SessionWatcher;
