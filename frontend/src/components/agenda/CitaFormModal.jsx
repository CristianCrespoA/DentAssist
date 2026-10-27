import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import {
  ESTADOS_CITA,
  esFechaValida,
  formatearFechaLarga,
  hoyBogotaISO,
  normalizarIdPositivo,
  sumarDias,
} from '../../lib/agenda';
import {
  aPayloadCita,
  formatearPrecio,
  horaCabeEnHorario,
  mapearErrorCita,
  ordenarHoras,
  resumenHorario,
  validarCita,
  valoresInicialesCita,
} from '../../lib/citas';
import { nombreCompleto } from '../../lib/pacientes';
import { actualizarCita, crearCita } from '../../services/citas';
import { obtenerDisponibilidad } from '../../services/disponibilidad';
import { listarProfesionales } from '../../services/profesionales';
import { listarServicios } from '../../services/servicios';
import PacienteFiltro from './PacienteFiltro';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import Spinner from '../ui/Spinner';
import Textarea from '../ui/Textarea';

const ID_FORMULARIO = 'formulario-cita';
const DURACION_POR_DEFECTO = 30;

const IDS_CAMPO = {
  pacienteId: 'cita-paciente',
  profesionalId: 'cita-profesional',
  servicioId: 'cita-servicio',
  fecha: 'cita-fecha',
  estado: 'cita-estado',
};

const DISPONIBILIDAD_INICIAL = {
  estado: 'incompleto',
  franjas: [],
  cerrado: false,
  horario: [],
  duracionMinutos: null,
  error: '',
};

const enfocarPrimerError = (errores) => {
  const campo = Object.keys(IDS_CAMPO).find((clave) => errores[clave]);

  if (campo) {
    document.getElementById(IDS_CAMPO[campo])?.focus();
    return;
  }

  if (errores.hora) {
    document.querySelector('input[name="cita-hora"]')?.focus();
  }
};

const compararPorNombre = (a, b, campo) =>
  String(a?.[campo] ?? '').localeCompare(String(b?.[campo] ?? ''), 'es');

function CitaFormModal({
  cita = null,
  fechaInicial,
  pacienteInicial,
  profesionalInicialId,
  onClose,
  onSaved,
}) {
  const esEdicion = Boolean(cita);
  const [valores, setValores] = useState(() =>
    valoresInicialesCita(cita, {
      fecha: fechaInicial,
      paciente: pacienteInicial,
      profesionalId: profesionalInicialId,
    }),
  );
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Guardia síncrona: el estado de React no se actualiza entre dos clics en el
  // mismo tick, así que el ref evita que se envíen varias peticiones seguidas.
  const enviandoRef = useRef(false);

  const [profesionales, setProfesionales] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorCatalogos, setErrorCatalogos] = useState('');
  const [versionCatalogos, setVersionCatalogos] = useState(0);

  const [disponibilidad, setDisponibilidad] = useState({
    ...DISPONIBILIDAD_INICIAL,
    clave: '',
  });
  const [versionDisponibilidad, setVersionDisponibilidad] = useState(0);

  const { error: toastError } = useToast();

  const hoy = hoyBogotaISO();
  const fechaOriginal = cita?.fecha ? String(cita.fecha).slice(0, 10) : '';
  const permitirFechaPasada = esEdicion && Boolean(fechaOriginal) && fechaOriginal < hoy;

  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;

    Promise.all([
      listarProfesionales({ signal: controlador.signal }),
      listarServicios({}, { signal: controlador.signal }),
    ])
      .then(([listaProfesionales, listaServicios]) => {
        if (!vigente) return;

        setProfesionales(
          (Array.isArray(listaProfesionales) ? [...listaProfesionales] : []).sort(
            (a, b) =>
              compararPorNombre(a, b, 'apellido') ||
              compararPorNombre(a, b, 'nombre'),
          ),
        );
        setServicios(
          (Array.isArray(listaServicios) ? [...listaServicios] : []).sort((a, b) =>
            compararPorNombre(a, b, 'nombre'),
          ),
        );
      })
      .catch((error) => {
        if (!vigente || error?.name === 'AbortError') return;

        setErrorCatalogos(
          error?.mensaje || 'No se pudo cargar el catálogo de profesionales y servicios.',
        );
      })
      .finally(() => {
        if (vigente) setCargandoCatalogos(false);
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [versionCatalogos]);

  useEffect(() => {
    const fecha = valores.fecha;
    const profesionalId = normalizarIdPositivo(valores.profesionalId);
    const servicioId = normalizarIdPositivo(valores.servicioId);

    // Los estados incompleto, histórico y fecha pasada se derivan en el render;
    // el efecto solo consulta la API cuando hay una fecha futura consultable.
    if (
      !esFechaValida(fecha) ||
      !profesionalId ||
      !servicioId ||
      fecha < hoy
    ) {
      return undefined;
    }

    const clave = `${fecha}|${profesionalId}|${servicioId}`;
    const controlador = new AbortController();
    let vigente = true;

    obtenerDisponibilidad(
      { fecha, profesionalId, servicioId },
      { signal: controlador.signal },
    )
      .then((respuesta) => {
        if (!vigente) return;

        let franjas = ordenarHoras(
          Array.isArray(respuesta?.franjas) ? respuesta.franjas : [],
        );
        const horaActual = cita?.hora ? String(cita.hora).slice(0, 5) : '';
        const mismaFecha = esEdicion && fecha === fechaOriginal;
        const mismoProfesional =
          esEdicion && profesionalId === String(cita?.profesionalId);

        // La disponibilidad excluye todas las citas del profesional, incluida
        // la que se está editando. Si sigue cumpliendo el horario, se vuelve a
        // ofrecer su hora actual para no forzar una reprogramación.
        if (
          horaActual &&
          mismaFecha &&
          mismoProfesional &&
          !franjas.includes(horaActual) &&
          horaCabeEnHorario(
            horaActual,
            respuesta?.horario,
            respuesta?.duracionMinutos,
          )
        ) {
          franjas = ordenarHoras([...franjas, horaActual]);
        }

        setDisponibilidad({
          clave,
          estado: 'listo',
          franjas,
          cerrado: Boolean(respuesta?.cerrado),
          horario: Array.isArray(respuesta?.horario) ? respuesta.horario : [],
          duracionMinutos: Number(respuesta?.duracionMinutos) || null,
          error: '',
        });

        setValores((actuales) => {
          if (!actuales.hora) return actuales;

          return franjas.includes(actuales.hora)
            ? actuales
            : { ...actuales, hora: '' };
        });
      })
      .catch((error) => {
        if (!vigente || error?.name === 'AbortError') return;

        setDisponibilidad({
          clave,
          estado: 'error',
          franjas: [],
          cerrado: false,
          horario: [],
          duracionMinutos: null,
          error:
            error?.mensaje ||
            'No se pudieron cargar las horas disponibles. Inténtalo de nuevo.',
        });
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [
    valores.fecha,
    valores.profesionalId,
    valores.servicioId,
    versionDisponibilidad,
    cita,
    esEdicion,
    fechaOriginal,
    hoy,
  ]);

  const profesionalIdConsulta = normalizarIdPositivo(valores.profesionalId);
  const servicioIdConsulta = normalizarIdPositivo(valores.servicioId);
  const claveConsulta = `${valores.fecha}|${profesionalIdConsulta}|${servicioIdConsulta}`;
  const consultaCompleta =
    esFechaValida(valores.fecha) &&
    Boolean(profesionalIdConsulta) &&
    Boolean(servicioIdConsulta);

  let disponibilidadActual;

  if (!consultaCompleta) {
    disponibilidadActual = DISPONIBILIDAD_INICIAL;
  } else if (valores.fecha < hoy) {
    disponibilidadActual = {
      ...DISPONIBILIDAD_INICIAL,
      estado: permitirFechaPasada ? 'historica' : 'fecha-pasada',
    };
  } else if (disponibilidad.clave === claveConsulta) {
    disponibilidadActual = disponibilidad;
  } else {
    disponibilidadActual = {
      ...DISPONIBILIDAD_INICIAL,
      estado: 'cargando',
    };
  }

  const servicioSeleccionado = useMemo(
    () =>
      servicios.find((servicio) => String(servicio.id) === valores.servicioId) ||
      (esEdicion ? cita?.servicio ?? null : null),
    [servicios, valores.servicioId, esEdicion, cita],
  );

  const profesionalSeleccionado = useMemo(
    () =>
      profesionales.find(
        (profesional) => String(profesional.id) === valores.profesionalId,
      ) ||
      (esEdicion ? cita?.profesional ?? null : null),
    [profesionales, valores.profesionalId, esEdicion, cita],
  );

  const duracionMinutos =
    Number(servicioSeleccionado?.duracionMinutos) ||
    Number(disponibilidadActual.duracionMinutos) ||
    DURACION_POR_DEFECTO;
  const resumen = resumenHorario(valores.hora, duracionMinutos);

  const profesionalEnCatalogo = profesionales.some(
    (profesional) => String(profesional.id) === valores.profesionalId,
  );
  const servicioEnCatalogo = servicios.some(
    (servicio) => String(servicio.id) === valores.servicioId,
  );

  const cerrar = () => {
    if (!guardando) onClose();
  };

  const limpiarErrores = (...campos) => {
    setErrores((actuales) => {
      if (!campos.some((campo) => actuales[campo])) return actuales;

      const siguientes = { ...actuales };
      campos.forEach((campo) => delete siguientes[campo]);
      return siguientes;
    });
  };

  const actualizarCampo = (campo) => (evento) => {
    const { value } = evento.target;
    const cambiaDisponibilidad = ['fecha', 'profesionalId', 'servicioId'].includes(
      campo,
    );
    // En citas históricas la hora se conserva: no hay disponibilidad que
    // consultar y el backend acepta la hora registrada dentro del horario.
    const conservarHora =
      campo === 'fecha' &&
      permitirFechaPasada &&
      esFechaValida(value) &&
      value < hoy;

    setValores((actuales) => ({
      ...actuales,
      [campo]: value,
      ...(cambiaDisponibilidad && !conservarHora ? { hora: '' } : {}),
    }));

    limpiarErrores(campo, ...(cambiaDisponibilidad && !conservarHora ? ['hora'] : []));
    if (errorGeneral) setErrorGeneral('');
  };

  const seleccionarPaciente = (paciente) => {
    if (!paciente) return;

    setValores((actuales) => ({
      ...actuales,
      pacienteId: String(paciente.id),
      paciente,
    }));
    limpiarErrores('pacienteId');
    if (errorGeneral) setErrorGeneral('');
  };

  const limpiarPaciente = () => {
    setValores((actuales) => ({
      ...actuales,
      pacienteId: '',
      paciente: null,
    }));
    limpiarErrores('pacienteId');
  };

  const seleccionarHora = (hora) => {
    setValores((actuales) => ({ ...actuales, hora }));
    limpiarErrores('hora');
    if (errorGeneral) setErrorGeneral('');
  };

  const verDiaSiguiente = () => {
    setValores((actuales) => ({
      ...actuales,
      fecha: sumarDias(actuales.fecha, 1),
      hora: '',
    }));
    limpiarErrores('fecha', 'hora');
    if (errorGeneral) setErrorGeneral('');
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();

    if (enviandoRef.current) return;

    const erroresCliente = validarCita(valores, {
      esEdicion,
      permitirFechaPasada,
      franjas:
        disponibilidadActual.estado === 'listo'
          ? disponibilidadActual.franjas
          : null,
    });

    if (!permitirFechaPasada && !erroresCliente.hora) {
      if (disponibilidadActual.estado === 'incompleto') {
        erroresCliente.hora = 'Selecciona una hora disponible.';
      } else if (disponibilidadActual.estado === 'cargando') {
        erroresCliente.hora = 'Espera a que terminen de cargar las horas disponibles.';
      } else if (disponibilidadActual.estado === 'error') {
        erroresCliente.hora =
          disponibilidadActual.error ||
          'No se pudieron cargar las horas disponibles.';
      } else if (disponibilidadActual.estado === 'fecha-pasada') {
        erroresCliente.fecha = 'La fecha no puede ser anterior a hoy.';
      }
    }

    if (Object.keys(erroresCliente).length) {
      setErrores(erroresCliente);
      setErrorGeneral('');
      enfocarPrimerError(erroresCliente);
      return;
    }

    enviandoRef.current = true;
    setGuardando(true);
    setErrores({});
    setErrorGeneral('');

    try {
      const datos = aPayloadCita(valores, { esEdicion });
      const guardada = esEdicion
        ? await actualizarCita(cita.id, datos)
        : await crearCita(datos);

      onSaved(guardada, esEdicion);
    } catch (error) {
      if (error?.name === 'AbortError' || error?.status === 401) return;

      const mensaje =
        error?.mensaje || 'No se pudo guardar la cita. Inténtalo de nuevo.';
      const mapeado = mapearErrorCita(mensaje);

      if (error?.status === 409) {
        const erroresConflicto = {
          ...mapeado.errores,
          hora: 'La franja seleccionada ya no está disponible.',
        };

        setErrores(erroresConflicto);
        setErrorGeneral(mensaje);
        enfocarPrimerError(erroresConflicto);
      } else if (error?.status === 404) {
        const hayCampo = Object.keys(mapeado.errores).length > 0;

        setErrores(mapeado.errores);
        setErrorGeneral(
          hayCampo
            ? 'Una referencia de la cita ya no existe. Revisa los datos seleccionados.'
            : mensaje,
        );
        enfocarPrimerError(mapeado.errores);
        toastError(mensaje, { titulo: 'No se pudo guardar la cita' });
      } else {
        setErrores(mapeado.errores);
        setErrorGeneral(mapeado.general || '');
        enfocarPrimerError(mapeado.errores);
        toastError(mensaje, { titulo: 'No se pudo guardar la cita' });
      }
    } finally {
      enviandoRef.current = false;
      setGuardando(false);
    }
  };

  const renderizarHorario = () => {
    if (disponibilidadActual.estado === 'incompleto') {
      return (
        <p className="text-sm text-neutral-600">
          Selecciona fecha, profesional y servicio para consultar las horas
          disponibles.
        </p>
      );
    }

    if (disponibilidadActual.estado === 'cargando') {
      return (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Spinner size="sm" label="Consultando disponibilidad" />
          <span>Buscando cupos disponibles…</span>
        </div>
      );
    }

    if (disponibilidadActual.estado === 'error') {
      return (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-field border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-danger-600"
              aria-hidden="true"
            />
            <span>{disponibilidadActual.error}</span>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVersionDisponibilidad((actual) => actual + 1)}
            leftIcon={<RefreshCw aria-hidden="true" />}
          >
            Reintentar
          </Button>
        </div>
      );
    }

    if (disponibilidadActual.estado === 'fecha-pasada') {
      return (
        <p className="text-sm text-danger-700">
          No se puede consultar disponibilidad para una fecha pasada.
        </p>
      );
    }

    if (disponibilidadActual.estado === 'historica') {
      return (
        <div className="space-y-2 rounded-field border border-neutral-200 bg-neutral-50 px-3 py-2.5">
          <p className="text-sm text-neutral-700">
            Esta cita es histórica. Se conserva la hora registrada y no se
            consulta la disponibilidad de fechas pasadas.
          </p>
          {valores.hora ? (
            <p className="text-sm font-semibold tabular-nums text-neutral-900">
              {valores.hora}
              {resumen.fin ? ` – ${resumen.fin}` : ''}
            </p>
          ) : null}
        </div>
      );
    }

    if (!disponibilidadActual.franjas.length) {
      return (
        <div className="space-y-3 rounded-field border border-warning-200 bg-warning-50 px-3 py-3">
          <p className="text-sm text-warning-900">
            {disponibilidadActual.cerrado
              ? 'La clínica no atiende este día.'
              : 'No quedan cupos disponibles para este día con el profesional y el servicio seleccionados.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={verDiaSiguiente}
            leftIcon={<CalendarDays aria-hidden="true" />}
          >
            Ver día siguiente
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div
          role="radiogroup"
          aria-label="Horas disponibles"
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          {disponibilidadActual.franjas.map((franja) => {
            const seleccionada = valores.hora === franja;

            return (
              <label
                key={franja}
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-field border px-2 py-2 text-sm font-semibold tabular-nums transition-colors focus-within:ring-2 focus-within:ring-primary-600/40',
                  seleccionada
                    ? 'border-primary-600 bg-primary-50 text-primary-900 ring-1 ring-primary-600'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-500 hover:text-primary-800',
                )}
              >
                <input
                  type="radio"
                  name="cita-hora"
                  value={franja}
                  checked={seleccionada}
                  onChange={() => seleccionarHora(franja)}
                  className="sr-only"
                />
                {franja}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500">
          Cada franja reserva {duracionMinutos} minutos de atención.
        </p>
      </div>
    );
  };

  return (
    <Modal
      open
      onClose={cerrar}
      title={esEdicion ? 'Editar cita' : 'Nueva cita'}
      description={
        esEdicion
          ? `Cita #${cita.id} · ${formatearFechaLarga(cita.fecha)}`
          : 'Registra una cita y elige una franja disponible.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={ID_FORMULARIO}
            isLoading={guardando}
            loadingLabel="Guardando…"
          >
            {esEdicion ? 'Guardar cambios' : 'Crear cita'}
          </Button>
        </>
      }
    >
      <form
        id={ID_FORMULARIO}
        className="space-y-5"
        onSubmit={manejarEnvio}
        noValidate
      >
        {errorGeneral ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-field border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-800"
          >
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-danger-600"
              aria-hidden="true"
            />
            <p>{errorGeneral}</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Paciente"
            htmlFor={IDS_CAMPO.pacienteId}
            error={errores.pacienteId}
            required
            className="sm:col-span-2"
          >
            <PacienteFiltro
              id={IDS_CAMPO.pacienteId}
              pacienteId={valores.pacienteId}
              etiqueta={nombreCompleto(valores.paciente)}
              onSelect={seleccionarPaciente}
              onClear={limpiarPaciente}
              permitirTodos={false}
              placeholder="Buscar y seleccionar paciente"
              invalid={Boolean(errores.pacienteId)}
            />
          </Field>

          <Field
            label="Profesional"
            htmlFor={IDS_CAMPO.profesionalId}
            error={errores.profesionalId}
            required
          >
            <Select
              id={IDS_CAMPO.profesionalId}
              value={valores.profesionalId}
              onChange={actualizarCampo('profesionalId')}
              disabled={cargandoCatalogos}
              invalid={Boolean(errores.profesionalId)}
            >
              <option value="">
                {cargandoCatalogos ? 'Cargando profesionales…' : 'Selecciona un profesional'}
              </option>
              {valores.profesionalId && !profesionalEnCatalogo && !cargandoCatalogos ? (
                <option value={valores.profesionalId}>
                  Profesional #{valores.profesionalId} (no disponible)
                </option>
              ) : null}
              {profesionales.map((profesional) => (
                <option key={profesional.id} value={profesional.id}>
                  {nombreCompleto(profesional)}
                  {profesional.especialidad ? ` · ${profesional.especialidad}` : ''}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Servicio"
            htmlFor={IDS_CAMPO.servicioId}
            error={errores.servicioId}
            hint={
              servicioSeleccionado
                ? `${duracionMinutos} minutos · ${formatearPrecio(
                    servicioSeleccionado.precio,
                  )}`
                : 'La duración del servicio define el fin de la cita.'
            }
            required
          >
            <Select
              id={IDS_CAMPO.servicioId}
              value={valores.servicioId}
              onChange={actualizarCampo('servicioId')}
              disabled={cargandoCatalogos}
              invalid={Boolean(errores.servicioId)}
            >
              <option value="">
                {cargandoCatalogos ? 'Cargando servicios…' : 'Selecciona un servicio'}
              </option>
              {valores.servicioId && !servicioEnCatalogo && !cargandoCatalogos ? (
                <option value={valores.servicioId}>
                  Servicio #{valores.servicioId} (no disponible)
                </option>
              ) : null}
              {servicios.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.nombre} · {servicio.duracionMinutos} min ·{' '}
                  {formatearPrecio(servicio.precio)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Fecha"
            htmlFor={IDS_CAMPO.fecha}
            error={errores.fecha}
            hint={
              permitirFechaPasada
                ? 'Cita histórica: se permite conservar o mover la fecha dentro del pasado.'
                : undefined
            }
            required
            className={esEdicion ? undefined : 'sm:col-span-2'}
          >
            <Input
              id={IDS_CAMPO.fecha}
              type="date"
              value={valores.fecha}
              min={permitirFechaPasada ? undefined : hoy}
              onChange={actualizarCampo('fecha')}
              invalid={Boolean(errores.fecha)}
            />
          </Field>

          {esEdicion ? (
            <Field
              label="Estado"
              htmlFor={IDS_CAMPO.estado}
              error={errores.estado}
              hint="Solo las citas canceladas se pueden eliminar."
              required
            >
              <Select
                id={IDS_CAMPO.estado}
                value={valores.estado}
                onChange={actualizarCampo('estado')}
                invalid={Boolean(errores.estado)}
              >
                {ESTADOS_CITA.map((estado) => (
                  <option key={estado.valor} value={estado.valor}>
                    {estado.etiqueta}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <div className="space-y-1.5 sm:col-span-2">
            <fieldset>
              <legend className="block text-sm font-medium text-neutral-800">
                Hora
                <span className="ml-0.5 text-danger-600" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="mt-1.5">{renderizarHorario()}</div>
            </fieldset>

            {errores.hora ? (
              <p role="alert" className="text-sm font-medium text-danger-700">
                {errores.hora}
              </p>
            ) : null}
          </div>

          <Field
            label="Observaciones"
            htmlFor="cita-observaciones"
            hint="Opcional. Se muestran en el detalle de la cita."
            className="sm:col-span-2"
          >
            <Textarea
              id="cita-observaciones"
              rows={3}
              value={valores.observaciones}
              onChange={actualizarCampo('observaciones')}
              placeholder="Indicaciones o notas para la cita"
            />
          </Field>
        </div>

        {errorCatalogos ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-field border border-warning-200 bg-warning-50 px-3 py-2.5 text-sm text-warning-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-warning-700"
                aria-hidden="true"
              />
              <span>{errorCatalogos}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCargandoCatalogos(true);
                setErrorCatalogos('');
                setVersionCatalogos((actual) => actual + 1);
              }}
              leftIcon={<RefreshCw aria-hidden="true" />}
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        <div className="rounded-card border border-neutral-200 bg-neutral-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Resumen de la cita
          </h3>
          <dl className="mt-2 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Paciente
              </dt>
              <dd className="mt-0.5 truncate text-neutral-900">
                {nombreCompleto(valores.paciente) || 'Sin seleccionar'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Profesional
              </dt>
              <dd className="mt-0.5 truncate text-neutral-900">
                {nombreCompleto(profesionalSeleccionado) || 'Sin seleccionar'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Servicio
              </dt>
              <dd className="mt-0.5 truncate text-neutral-900">
                {servicioSeleccionado?.nombre || 'Sin seleccionar'}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Fecha
              </dt>
              <dd className="mt-0.5 text-neutral-900">
                {valores.fecha ? formatearFechaLarga(valores.fecha) : 'Sin fecha'}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Horario
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-neutral-900">
                {resumen.inicio && resumen.fin
                  ? `${resumen.inicio} – ${resumen.fin} (${duracionMinutos} min)`
                  : 'Selecciona una hora disponible'}
              </dd>
            </div>
          </dl>
        </div>
      </form>
    </Modal>
  );
}

export default CitaFormModal;
