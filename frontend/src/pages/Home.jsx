import { useAuth } from '../hooks/useAuth';

const etiquetasRol = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
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
      <p style={{ color: '#666', fontSize: '14px' }}>
        Los pacientes gestionan sus citas y solicitudes a través de WhatsApp.
      </p>
    </div>
  );
}

export default Home;
