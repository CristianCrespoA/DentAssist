import { useState } from 'react';
import { AuthContext } from './authContextBase';

const leerUsuarioGuardado = () => {
  try {
    const guardado = localStorage.getItem('usuario');
    return guardado ? JSON.parse(guardado) : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(leerUsuarioGuardado);

  const login = (tokenRecibido, usuarioRecibido) => {
    localStorage.setItem('token', tokenRecibido);
    localStorage.setItem('usuario', JSON.stringify(usuarioRecibido));
    setToken(tokenRecibido);
    setUsuario(usuarioRecibido);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setToken(null);
    setUsuario(null);
  };

  const estaAutenticado = () => !!token;

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout, estaAutenticado }}>
      {children}
    </AuthContext.Provider>
  );
};
