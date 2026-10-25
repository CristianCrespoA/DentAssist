import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <>
      <Navbar />
      <main style={estilos.main}>
        <Outlet />
      </main>
    </>
  );
};

const estilos = {
  main: {
    padding: '20px',
    minHeight: 'calc(100vh - 70px)',
  },
};

export default Layout;
