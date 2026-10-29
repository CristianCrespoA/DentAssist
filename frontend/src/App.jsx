import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import SessionWatcher from './components/SessionWatcher';
import { ToastProvider } from './components/ui/ToastProvider';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Agenda from './pages/Agenda';
import Login from './pages/Login';
import Pacientes from './pages/Pacientes';
import Solicitudes from './pages/Solicitudes';
import UsuariosPage from './pages/UsuariosPage';
import { useAuth } from './hooks/useAuth';

const AdminRoute = ({ children }) => {
  const { usuario } = useAuth();
  if (usuario?.rol !== 'admin') return <Navigate to="/agenda" replace />;
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <SessionWatcher />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                <Route index element={<Navigate to="/agenda" replace />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="pacientes" element={<Pacientes />} />
                <Route path="solicitudes" element={<Solicitudes />} />
                <Route path="usuarios" element={<AdminRoute><UsuariosPage /></AdminRoute>} />
              </Route>
              <Route path="*" element={<Navigate to="/agenda" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
