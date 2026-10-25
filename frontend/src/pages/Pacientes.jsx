import { Users } from 'lucide-react';
import EnConstruccion from '../components/EnConstruccion';

const Pacientes = () => (
  <EnConstruccion
    titulo="Pacientes"
    descripcion="Gestiona los datos de contacto de los pacientes de la clínica."
    Icono={Users}
    proximo="Disponible en el PR 6"
  />
);

export default Pacientes;
