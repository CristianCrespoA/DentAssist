import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ExternalLink,
  Info,
  Mail,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  META_ESTADO,
  esFechaValida,
  formatearFechaLarga,
  formatearHora,
} from '../../lib/agenda';
import {
  formatearTelefono,
  hrefTelefono,
  nombreCompleto,
} from '../../lib/pacientes';
import {
  META_ORIGEN,
  META_TIPO,
  describirEfecto,
  etiquetaEstadoSolicitud,
  formatearFechaHoraSolicitud,
  formatearHoraPropuesta,
  puedeResolver,
  puedeTomarEnAtencion,
  varianteEstadoSolicitud,
} from '../../lib/solicitudes';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Field from '../ui/Field';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import Textarea from '../ui/Textarea';

const TONOS_ALERTA = {
  danger: {
    contenedor: 'border-danger-200 bg-danger-50 text-danger-800',
    icono: 'text-danger-600',
  },
  warning: {
    contenedor: 'border-warning-200 bg-warning-50 text-warning-900',
    icono: 'text-warning-700',
  },
  info: {
    contenedor: 'border-primary-200 bg-primary-50 text-primary-900',
    icono: 'text-primary-700',
  },
};

const PUNTOS_HISTORIAL = {
  warning: 'bg-warning-500',
  info: 'bg-sky-500',
  success: 'bg-success-600',
  neutral: 'bg-neutral-400',
};

const ICONOS_EFECTO = {
  cancelacion: CalendarX2,
  reprogramacion: CalendarClock,
};

function Alerta({ tono = 'danger', children }) {
  const estilo = TONOS_ALERTA[tono] || TONOS_ALERTA.danger;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-field border px-3 py-2.5 text-sm',
        estilo.contenedor,
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 size-4 shrink-0', estilo.icono)}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

function Dato({ etiqueta, valor, className }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {etiqueta}
      </dt>
      <dd className="mt-1 break-words text-sm text-neutral-900">
        {valor || '—'}
      </dd>
    </div>
  );
}

function Seccion({ id, titulo, icono: Icono, children }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3
        id={id}
        className="flex items-center gap-2 text-sm font-semibold text-neutral-900"
      >
        {Icono ? (
          <Icono className="size-4 text-neutral-500" aria-hidden="true" />
        ) : null}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function ContenidoCargando() {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-neutral-600">
      <Spinner size="md" />
      <span>Cargando la solicitud…</span>
    </div>
  );
}

function ErrorCarga({ mensaje, onReintentar }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-700">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <p className="max-w-md text-sm text-neutral-600">{mensaje}</p>
      <Button
        variant="secondary"
        onClick={onReintentar}
        leftIcon={<RefreshCw aria-hidden="true" />}
      >
        Reintentar
      </Button>
    </div>
  );
}

/**
 * Detalle de una solicitud con los datos del paciente, el mensaje original,
 * la cita vinculada, la propuesta de reprogramación y su historial. Todas las
 * acciones piden confirmación o comentario y los errores de negocio se muestran
 * sin cerrar el panel.
 */
function SolicitudDetalleModal({
  abierta,
  solicitud,
  cargando,
  error,
  onReintentar,
  onClose,
  onCambiarEstado,
}) {
  const [resolviendo, setResolviendo] = useState(false);
  const [comentario, setComentario] = useState('');
  const [errorComentario, setErrorComentario] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [errorResolucion, setErrorResolucion] = useState('');
  const [alternativas, setAlternativas] = useState([]);
  const [procesando, setProcesando] = useState(null);

  if (!abierta) return null;

  const estado = solicitud
    ? {
        etiqueta: etiquetaEstadoSolicitud(solicitud.estado),
        variante: varianteEstadoSolicitud(solicitud.estado),
      }
    : null;
  const tipo = META_TIPO[solicitud?.tipo] || META_TIPO.otra;
  const origen = META_ORIGEN[solicitud?.origen] || {
    etiqueta: solicitud?.origen || '—',
  };
  const cita = solicitud?.cita;
  const estadoCita = cita
    ? META_ESTADO[cita.estado] || META_ESTADO.programada
    : null;
  const paciente = solicitud?.paciente;
  const enlaceTelefono = hrefTelefono(paciente?.telefono);
  const historial = Array.isArray(solicitud?.historial)
    ? solicitud.historial
    : [];
  const efecto = solicitud ? describirEfecto(solicitud) : null;
  const IconoEfecto = ICONOS_EFECTO[solicitud?.tipo] || CheckCircle2;
  const fechaAgenda = String(
    solicitud?.fechaPropuesta || cita?.fecha || '',
  ).slice(0, 10);
  const enlaceAgenda = esFechaValida(fechaAgenda)
    ? `/agenda?fecha=${fechaAgenda}${
        solicitud?.pacienteId ? `&pacienteId=${solicitud.pacienteId}` : ''
      }`
    : '';

  const cerrar = () => {
    if (procesando) return;
    onClose();
  };

  const tomarEnAtencion = async () => {
    if (!solicitud || procesando) return;

    setErrorAccion('');
    setProcesando('en_atencion');

    try {
      await onCambiarEstado(solicitud.id, 'en_atencion');
    } catch (fallo) {
      if (fallo?.name === 'AbortError') return;
      setErrorAccion(
        fallo?.mensaje || 'No se pudo tomar la solicitud. Inténtalo de nuevo.',
      );
    } finally {
      setProcesando(null);
    }
  };

  const abrirResolucion = () => {
    setComentario('');
    setErrorComentario('');
    setErrorResolucion('');
    setAlternativas([]);
    setResolviendo(true);
  };

  const cerrarResolucion = () => setResolviendo(false);

  const confirmarResolucion = async () => {
    if (!solicitud || procesando === 'resuelta') return;

    const limpio = comentario.trim();

    if (!limpio) {
      setErrorComentario('Escribe un comentario para resolver la solicitud.');
      return;
    }

    setErrorComentario('');
    setErrorResolucion('');
    setAlternativas([]);
    setProcesando('resuelta');

    try {
      await onCambiarEstado(solicitud.id, 'resuelta', limpio);
      setResolviendo(false);
    } catch (fallo) {
      if (fallo?.name === 'AbortError') return;

      setErrorResolucion(
        fallo?.mensaje || 'No se pudo resolver la solicitud. Inténtalo de nuevo.',
      );
      setAlternativas(
        Array.isArray(fallo?.datos?.alternativas) ? fallo.datos.alternativas : [],
      );
    } finally {
      setProcesando(null);
    }
  };

  const mostrarAcciones = Boolean(solicitud) && !cargando && !error;
  const footer = mostrarAcciones ? (
    <>
      <Button variant="secondary" onClick={cerrar} disabled={Boolean(procesando)}>
        Cerrar
      </Button>
      {puedeTomarEnAtencion(solicitud) ? (
        <Button
          variant="secondary"
          onClick={tomarEnAtencion}
          isLoading={procesando === 'en_atencion'}
          loadingLabel="Tomando…"
          leftIcon={<Info aria-hidden="true" />}
        >
          Tomar en atención
        </Button>
      ) : null}
      {puedeResolver(solicitud) ? (
        <Button
          variant="success"
          onClick={abrirResolucion}
          disabled={Boolean(procesando)}
          leftIcon={<CheckCircle2 aria-hidden="true" />}
        >
          Resolver
        </Button>
      ) : null}
    </>
  ) : (
    <Button variant="secondary" onClick={cerrar}>
      Cerrar
    </Button>
  );

  return (
    <>
      <Modal
        open={abierta}
        onClose={cerrar}
        title={solicitud ? `Solicitud #${solicitud.id}` : 'Solicitud'}
        description={
          solicitud
            ? `Recibida el ${formatearFechaHoraSolicitud(solicitud.fechaSolicitud)}`
            : 'Detalle de la solicitud'
        }
        size="lg"
        footer={footer}
      >
        {cargando ? <ContenidoCargando /> : null}

        {!cargando && error ? (
          <ErrorCarga mensaje={error} onReintentar={onReintentar} />
        ) : null}

        {!cargando && !error && solicitud ? (
          <div className="space-y-6">
            {errorAccion ? (
              <Alerta>
                <p>{errorAccion}</p>
              </Alerta>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={estado.variante} dot>
                {estado.etiqueta}
              </Badge>
              <Badge variant={tipo.variante}>{tipo.etiqueta}</Badge>
              <span className="text-xs text-neutral-500">
                Origen: {origen.etiqueta}
              </span>
              {procesando ? (
                <span className="ml-auto flex items-center gap-2 text-xs text-neutral-500">
                  <Spinner size="sm" label={null} />
                  Guardando…
                </span>
              ) : null}
            </div>

            <Seccion id="solicitud-paciente" titulo="Paciente">
              <div className="rounded-card border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-base font-semibold text-neutral-900">
                  {nombreCompleto(paciente) || 'Paciente sin nombre'}
                </p>
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  {enlaceTelefono ? (
                    <a
                      href={enlaceTelefono}
                      className="inline-flex items-center gap-2 text-primary-700 underline-offset-2 hover:underline"
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      {formatearTelefono(paciente.telefono)}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-neutral-500">
                      <Phone className="size-4" aria-hidden="true" />
                      Sin teléfono
                    </span>
                  )}
                  {paciente?.correo ? (
                    <a
                      href={`mailto:${paciente.correo}`}
                      className="inline-flex items-center gap-2 break-all text-primary-700 underline-offset-2 hover:underline"
                    >
                      <Mail className="size-4" aria-hidden="true" />
                      {paciente.correo}
                    </a>
                  ) : null}
                </div>
              </div>
            </Seccion>

            <Seccion id="solicitud-mensaje" titulo="Mensaje original">
              {solicitud.mensaje ? (
                <blockquote className="rounded-card border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800">
                  <p className="whitespace-pre-line">{solicitud.mensaje}</p>
                </blockquote>
              ) : (
                <p className="text-sm text-neutral-500">
                  La solicitud no incluye mensaje.
                </p>
              )}
              {solicitud.servicio?.nombre ? (
                <p className="text-xs text-neutral-500">
                  Servicio solicitado: {solicitud.servicio.nombre}
                </p>
              ) : null}
            </Seccion>

            <Seccion id="solicitud-cita" titulo="Cita relacionada">
              {cita ? (
                <div className="rounded-card border border-neutral-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900">
                        {formatearFechaLarga(cita.fecha)}
                      </p>
                      <p className="text-sm tabular-nums text-neutral-600">
                        {formatearHora(cita.hora) || 'Sin hora'}
                      </p>
                    </div>
                    {estadoCita ? (
                      <Badge variant={estadoCita.variante} dot>
                        {estadoCita.etiqueta}
                      </Badge>
                    ) : null}
                  </div>

                  <dl className="mt-3 grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2">
                    <Dato
                      etiqueta="Profesional"
                      valor={
                        <>
                          <span className="block">
                            {nombreCompleto(cita.profesional) || '—'}
                          </span>
                          {cita.profesional?.especialidad ? (
                            <span className="block text-xs text-neutral-500">
                              {cita.profesional.especialidad}
                            </span>
                          ) : null}
                        </>
                      }
                    />
                    <Dato etiqueta="Cita" valor={`#${cita.id}`} />
                  </dl>

                  {enlaceAgenda ? (
                    <Link
                      to={enlaceAgenda}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 underline-offset-2 hover:underline"
                    >
                      Ver en la agenda
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-card border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600">
                  Esta solicitud no tiene una cita vinculada.
                </p>
              )}
            </Seccion>

            {solicitud.tipo === 'reprogramacion' ? (
              <Seccion
                id="solicitud-propuesta"
                titulo="Propuesta de reprogramación"
              >
                {solicitud.fechaPropuesta && solicitud.horaPropuesta ? (
                  <div className="rounded-card border border-sky-200 bg-sky-50 px-4 py-3">
                    <p className="text-sm font-semibold text-sky-900">
                      {formatearFechaLarga(solicitud.fechaPropuesta)}
                    </p>
                    <p className="text-sm tabular-nums text-sky-800">
                      {formatearHoraPropuesta(solicitud.horaPropuesta)}
                    </p>
                    <p className="mt-1 text-xs text-sky-800">
                      Horario propuesto por el paciente. Al resolver se valida
                      que siga disponible.
                    </p>
                  </div>
                ) : (
                  <Alerta tono="warning">
                    <p className="font-semibold">Falta la propuesta</p>
                    <p>
                      La solicitud no tiene fecha y hora propuestas, así que no
                      se puede resolver como reprogramación.
                    </p>
                  </Alerta>
                )}
              </Seccion>
            ) : null}

            <Seccion id="solicitud-historial" titulo="Historial">
              {historial.length ? (
                <ol className="mt-1 space-y-4">
                  {historial.map((fila) => {
                    const variante = varianteEstadoSolicitud(fila.estadoNuevo);

                    return (
                      <li
                        key={fila.id}
                        className="relative border-l border-neutral-200 pl-4"
                      >
                        <span
                          className={cn(
                            'absolute -left-[5.5px] top-1.5 size-2.5 rounded-full ring-2 ring-white',
                            PUNTOS_HISTORIAL[variante] ||
                              PUNTOS_HISTORIAL.neutral,
                          )}
                          aria-hidden="true"
                        />
                        <p className="text-sm font-semibold text-neutral-900">
                          {etiquetaEstadoSolicitud(fila.estadoAnterior)} →{' '}
                          {etiquetaEstadoSolicitud(fila.estadoNuevo)}
                        </p>
                        {fila.comentario ? (
                          <p className="mt-1 whitespace-pre-line text-sm text-neutral-700">
                            {fila.comentario}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-neutral-500">
                          {fila.usuario?.nombre || 'Sistema'} ·{' '}
                          {formatearFechaHoraSolicitud(fila.createdAt)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-neutral-500">
                  Todavía no hay cambios registrados para esta solicitud.
                </p>
              )}
            </Seccion>
          </div>
        ) : null}
      </Modal>

      {resolviendo && solicitud ? (
        <ConfirmDialog
          open
          onClose={cerrarResolucion}
          onConfirm={confirmarResolucion}
          title="Resolver solicitud"
          description="La solicitud quedará cerrada y no admitirá más cambios."
          confirmLabel="Resolver solicitud"
          variant="success"
          isLoading={procesando === 'resuelta'}
        >
          <div className="space-y-4">
            <div
              className={cn(
                'rounded-field border px-3 py-2.5 text-sm',
                TONOS_ALERTA[efecto.variante]?.contenedor ||
                  TONOS_ALERTA.info.contenedor,
              )}
            >
              <p className="flex items-center gap-2 font-semibold">
                <IconoEfecto className="size-4 shrink-0" aria-hidden="true" />
                {efecto.titulo}
              </p>
              <p className="mt-1">{efecto.detalle}</p>
            </div>

            <Field
              label="Comentario"
              htmlFor="comentario-resolucion"
              required
              error={errorComentario}
              hint="Se guarda en el historial de la solicitud y lo verá el equipo."
            >
              <Textarea
                id="comentario-resolucion"
                value={comentario}
                onChange={(evento) => {
                  setComentario(evento.target.value);
                  if (errorComentario) setErrorComentario('');
                }}
                placeholder="Explica cómo se atendió la solicitud"
                rows={3}
                aria-required="true"
              />
            </Field>

            {errorResolucion ? (
              <Alerta tono={alternativas.length ? 'warning' : 'danger'}>
                <p>{errorResolucion}</p>

                {alternativas.length ? (
                  <>
                    <p className="text-xs font-medium">
                      El horario propuesto no está disponible. Horas libres ese
                      día:
                    </p>
                    <ul className="flex flex-wrap gap-1.5 pt-1">
                      {alternativas.map((hora) => (
                        <li key={hora}>
                          <Badge variant="success" size="sm">
                            {hora}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs">
                      La cita no se movió y la solicitud sigue abierta.
                    </p>
                  </>
                ) : null}

                {enlaceAgenda ? (
                  <Link
                    to={enlaceAgenda}
                    onClick={cerrarResolucion}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2"
                  >
                    Elegir otro horario en la agenda
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </Alerta>
            ) : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export default SolicitudDetalleModal;
