import { useEffect, useState } from 'react';
import { AuthContext } from './authContextBase';
import { EVENTO_SESION_EXPIRADA } from '../services/api';

// La plataforma web es de uso exclusivo del personal de la clínica.
const ROLES_PERSONAL = ['admin', 'recepcionista'];

const leerSesionGuardada = () => {
  const sesionVacia = { token: null, usuario: null };

  try {
    const token = localStorage.getItem('token');
    const guardado = localStorage.getItem('usuario');

    if (!token || !guardado) return sesionVacia;

    const usuario = JSON.parse(guardado);

    if (!ROLES_PERSONAL.includes(usuario?.rol)) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      return sesionVacia;
    }

    return { token, usuario };
  } catch {
    return sesionVacia;
  }
};

export const AuthProvider = ({ children }) => {
  const [sesion, setSesion] = useState(leerSesionGuardada);

  const login = (tokenRecibido, usuarioRecibido) => {
    localStorage.setItem('token', tokenRecibido);
    localStorage.setItem('usuario', JSON.stringify(usuarioRecibido));
    setSesion({ token: tokenRecibido, usuario: usuarioRecibido });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setSesion({ token: null, usuario: null });
  };

  const estaAutenticado = () => !!sesion.token;

  useEffect(() => {
    const limpiarSesion = () => setSesion({ token: null, usuario: null });

    const sincronizarSesion = (evento) => {
      if (evento.key === 'token' || evento.key === 'usuario' || evento.key === null) {
        setSesion(leerSesionGuardada());
      }
    };

    window.addEventListener(EVENTO_SESION_EXPIRADA, limpiarSesion);
    window.addEventListener('storage', sincronizarSesion);

    return () => {
      window.removeEventListener(EVENTO_SESION_EXPIRADA, limpiarSesion);
      window.removeEventListener('storage', sincronizarSesion);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario: sesion.usuario, token: sesion.token, login, logout, estaAutenticado }}
    >
      {children}
    </AuthContext.Provider>
  );
};
