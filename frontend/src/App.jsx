import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import SessionWatcher from './components/SessionWatcher';
import { ToastProvider } from './components/ui/ToastProvider';
import { AuthProvider } from './context/AuthContext';
import Agenda from './pages/Agenda';
import Login from './pages/Login';
import Pacientes from './pages/Pacientes';
import Solicitudes from './pages/Solicitudes';

function App() {
  return (
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
            </Route>
            <Route path="*" element={<Navigate to="/agenda" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
