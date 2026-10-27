import { CalendarDays, CalendarRange } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  formatearFecha,
  formatearTelefono,
  hrefTelefono,
  nombreCompleto,
} from '../../lib/pacientes';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

function Dato({ etiqueta, valor, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm text-neutral-900">{valor || '—'}</dd>
    </div>
  );
}

function PacienteDetalleModal({
  paciente,
  onClose,
  onVerAgenda,
  onVerTodasLasCitas,
}) {
  const telefono = formatearTelefono(paciente.telefono);
  const enlaceTelefono = hrefTelefono(paciente.telefono);

  return (
    <Modal
      open
      onClose={onClose}
      title="Ficha del paciente"
      description={`Paciente #${paciente.id}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="secondary"
            onClick={() => onVerAgenda(paciente)}
            leftIcon={<CalendarDays aria-hidden="true" />}
          >
            Ver agenda del día
          </Button>
          <Button
            onClick={() => onVerTodasLasCitas(paciente)}
            leftIcon={<CalendarRange aria-hidden="true" />}
          >
            Todas sus citas
          </Button>
        </>
      }
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato
          etiqueta="Nombre completo"
          valor={nombreCompleto(paciente)}
          className="sm:col-span-2"
        />

        <Dato
          etiqueta="Teléfono"
          valor={
            enlaceTelefono ? (
              <a
                href={enlaceTelefono}
                className="text-primary-700 underline-offset-2 hover:underline"
              >
                {telefono}
              </a>
            ) : (
              telefono
            )
          }
        />

        <Dato
          etiqueta="Correo electrónico"
          valor={
            paciente.correo ? (
              <a
                href={`mailto:${paciente.correo}`}
                className="text-primary-700 underline-offset-2 hover:underline"
              >
                {paciente.correo}
              </a>
            ) : null
          }
        />

        <Dato
          etiqueta="Fecha de nacimiento"
          valor={formatearFecha(paciente.fechaNacimiento, { larga: true })}
        />

        <Dato etiqueta="Registrado" valor={formatearFecha(paciente.createdAt)} />

        <Dato
          etiqueta="Dirección"
          valor={paciente.direccion}
          className="sm:col-span-2"
        />
      </dl>
    </Modal>
  );
}

export default PacienteDetalleModal;
