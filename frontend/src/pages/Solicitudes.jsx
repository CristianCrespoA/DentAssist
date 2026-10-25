import { ClipboardList } from 'lucide-react';
import EnConstruccion from '../components/EnConstruccion';

const Solicitudes = () => (
  <EnConstruccion
    titulo="Solicitudes"
    descripcion="Atiende las solicitudes de citas recibidas por WhatsApp."
    Icono={ClipboardList}
    proximo="Disponible en el PR 9"
  />
);

export default Solicitudes;
