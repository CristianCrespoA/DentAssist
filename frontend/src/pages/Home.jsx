import { useAuth } from '../hooks/useAuth';

const etiquetasRol = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  paciente: 'Paciente',
};

function Home() {
  const { usuario } = useAuth();

  return (
    <div>
      <h1>Bienvenido a DentAssist</h1>
      <p>Hola, {usuario?.nombre}</p>
      <p>
        Rol: <strong>{etiquetasRol[usuario?.rol] || usuario?.rol}</strong>
      </p>
    </div>
  );
}

export default Home;