import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav style={estilos.nav}>
      <h2 style={estilos.logo}>Mi App</h2>
      <ul style={estilos.lista}>
        <li><Link to="/" style={estilos.link}>Inicio</Link></li>
        <li><Link to="/usuarios" style={estilos.link}>Usuarios</Link></li>
        <li><Link to="/productos" style={estilos.link}>Productos</Link></li>
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
    backgroundColor: '#282c34',
    color: 'white'
  },
  logo: { margin: 0 },
  lista: {
    display: 'flex',
    listStyle: 'none',
    gap: '20px',
    margin: 0,
    padding: 0
  },
  link: {
    color: 'white',
    textDecoration: 'none',
    fontWeight: 'bold'
  }
};

export default Navbar;