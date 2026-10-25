import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const PrivateRoute = ({ children }) => {
  const { estaAutenticado } = useAuth();

  return estaAutenticado() ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
