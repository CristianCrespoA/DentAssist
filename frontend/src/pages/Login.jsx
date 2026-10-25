import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, estaAutenticado } = useAuth();

  if (estaAutenticado()) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.mensaje || 'Error al iniciar sesión');
      }

      login(data.token, data.usuario);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={estilos.container}>
      <div style={estilos.card}>
        <h2 style={estilos.titulo}>Acceso del personal</h2>
        <p style={estilos.subtitulo}>
          Plataforma exclusiva para el personal de la clínica. Los pacientes gestionan sus citas
          por WhatsApp.
        </p>
        <form onSubmit={handleSubmit} style={estilos.form}>
          <div style={estilos.grupo}>
            <label style={estilos.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={estilos.input}
              required
            />
          </div>
          <div style={estilos.grupo}>
            <label style={estilos.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={estilos.input}
              required
            />
          </div>
          {error && <p style={estilos.error}>{error}</p>}
          <button type="submit" style={estilos.boton} disabled={loading}>
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

const estilos = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 'calc(100vh - 70px)',
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  titulo: {
    textAlign: 'center',
    marginBottom: '10px',
    color: '#333',
  },
  subtitulo: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    marginTop: 0,
    marginBottom: '25px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  grupo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '16px',
  },
  boton: {
    padding: '12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  error: {
    color: '#dc3545',
    textAlign: 'center',
    margin: 0,
  },
};

export default Login;
