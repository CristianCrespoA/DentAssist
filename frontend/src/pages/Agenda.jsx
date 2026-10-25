import { CalendarDays } from 'lucide-react';
import EnConstruccion from '../components/EnConstruccion';

const Agenda = () => (
  <EnConstruccion
    titulo="Agenda"
    descripcion="Consulta y administra las citas de la clínica."
    Icono={CalendarDays}
    proximo="Disponible en el PR 5"
  />
);

export default Agenda;
