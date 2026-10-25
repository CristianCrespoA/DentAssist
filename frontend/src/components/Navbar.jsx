import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const etiquetasRol = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
};

function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={estilos.nav}>
      <h2 style={estilos.logo}>DentAssist</h2>
      <ul style={estilos.lista}>
        <li><Link to="/" style={estilos.link}>Inicio</Link></li>
        {usuario && (
          <li style={estilos.usuario}>
            {usuario.nombre} ({etiquetasRol[usuario.rol] || usuario.rol})
          </li>
        )}
        <li>
          <button onClick={handleLogout} style={estilos.boton}>
            Cerrar Sesión
          </button>
        </li>
      </ul>
    </nav>
  );
}

const estilos = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 30px',
    backgroundColor: '#007bff',
    color: 'white'
  },
  logo: { margin: 0 },
  lista: {
    display: 'flex',
    alignItems: 'center',
    listStyle: 'none',
    gap: '20px',
    margin: 0,
    padding: 0
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontWeight: 'bold'
  },
  usuario: {
    color: 'white',
    fontSize: '14px'
  },
  boton: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

export default Navbar;
