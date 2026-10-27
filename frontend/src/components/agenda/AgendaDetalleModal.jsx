import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  META_ESTADO,
  formatearFechaLarga,
  rangoHorario,
} from '../../lib/agenda';
import {
  formatearTelefono,
  hrefTelefono,
  nombreCompleto,
} from '../../lib/pacientes';
import Badge from '../ui/Badge';
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

/** Detalle de solo lectura de una cita con accesos a editar y eliminar. */
function AgendaDetalleModal({ cita, onClose, onEditar, onEliminar }) {
  const estado = META_ESTADO[cita?.estado] || META_ESTADO.programada;
  const { inicio, fin, duracionMinutos } = rangoHorario(cita);
  const paciente = cita?.paciente;
  const telefono = formatearTelefono(paciente?.telefono);
  const enlaceTelefono = hrefTelefono(paciente?.telefono);
  const profesional = cita?.profesional;
  const esCancelada = cita?.estado === 'cancelada';

  return (
    <Modal
      open
      onClose={onClose}
      title="Detalle de la cita"
      description={`Cita #${cita.id} · ${formatearFechaLarga(cita.fecha)}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {esCancelada ? (
            <Button
              variant="danger"
              onClick={() => onEliminar(cita)}
              leftIcon={<Trash2 aria-hidden="true" />}
            >
              Eliminar
            </Button>
          ) : null}
          <Button
            onClick={() => onEditar(cita)}
            leftIcon={<Pencil aria-hidden="true" />}
          >
            Editar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Paciente
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {nombreCompleto(paciente) || '—'}
            </p>
            {enlaceTelefono ? (
              <a
                href={enlaceTelefono}
                className="mt-1 inline-block text-sm text-primary-700 underline-offset-2 hover:underline"
              >
                {telefono}
              </a>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">Sin teléfono</p>
            )}
          </div>

          <Badge variant={estado.variante} dot>
            {estado.etiqueta}
          </Badge>
        </div>

        <dl className="grid gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-2">
          <Dato
            etiqueta="Profesional"
            valor={
              <>
                <span className="block">{nombreCompleto(profesional) || '—'}</span>
                {profesional?.especialidad ? (
                  <span className="block text-xs text-neutral-500">
                    {profesional.especialidad}
                  </span>
                ) : null}
              </>
            }
          />

          <Dato
            etiqueta="Servicio"
            valor={
              <>
                <span className="block">{cita.servicio?.nombre || '—'}</span>
                <span className="block text-xs text-neutral-500">
                  {duracionMinutos} minutos
                </span>
              </>
            }
          />

          <Dato etiqueta="Fecha" valor={formatearFechaLarga(cita.fecha)} />

          <Dato
            etiqueta="Horario"
            valor={
              <span className="tabular-nums">
                {inicio || '—'} – {fin || '—'}
              </span>
            }
          />

          <Dato
            etiqueta="Observaciones"
            valor={
              cita.observaciones ? (
                <span className="whitespace-pre-line">{cita.observaciones}</span>
              ) : null
            }
            className="sm:col-span-2"
          />
        </dl>

        {!esCancelada ? (
          <p className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
            Para eliminar esta cita primero debes editarla y cambiar su estado a
            «Cancelada».
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

export default AgendaDetalleModal;
