import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SearchX,
  X,
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import {
  ESTADOS_CITA,
  META_ESTADO,
  agruparCitasPorFecha,
  construirResumen,
  esFechaValida,
  formatearFechaLarga,
  hoyBogotaISO,
  normalizarEstado,
  normalizarIdPositivo,
  rangoHorario,
  resumirTexto,
  sumarDias,
} from '../lib/agenda';
import { nombreCompleto } from '../lib/pacientes';
import { listarCitas } from '../services/citas';
import { obtenerPaciente } from '../services/pacientes';
import { listarProfesionales } from '../services/profesionales';
import PacienteFiltro from '../components/agenda/PacienteFiltro';
import AgendaDetalleModal from '../components/agenda/AgendaDetalleModal';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import Table from '../components/ui/Table';

const ETIQUETA_FILTROS = 'block text-sm font-medium text-neutral-800';

const construirParametros = ({
  fecha,
  pacienteId,
  profesionalId,
  estado,
  todas,
}) => {
  const parametros = new URLSearchParams();

  if (todas) {
    parametros.set('vista', 'todas');
  } else {
    parametros.set('fecha', fecha);
  }

  if (pacienteId) parametros.set('pacienteId', pacienteId);
  if (profesionalId) parametros.set('profesionalId', profesionalId);
  if (estado) parametros.set('estado', estado);

  return parametros;
};

function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { info } = useToast();

  const hoy = hoyBogotaISO();
  const fechaParam = searchParams.get('fecha');
  const fecha = esFechaValida(fechaParam) ? fechaParam : hoy;
  const todas = searchParams.get('vista') === 'todas';
  const pacienteId = normalizarIdPositivo(searchParams.get('pacienteId'));
  const profesionalId = normalizarIdPositivo(searchParams.get('profesionalId'));
  const estado = normalizarEstado(searchParams.get('estado'));

  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [version, setVersion] = useState(0);

  const [consultaPaciente, setConsultaPaciente] = useState({
    id: '',
    paciente: null,
    error: '',
  });

  const [profesionales, setProfesionales] = useState([]);
  const [errorProfesionales, setErrorProfesionales] = useState('');

  const [detalleId, setDetalleId] = useState(null);

  const hayDatos = useRef(false);

  // La URL siempre queda con una fecha válida y sin parámetros desconocidos.
  useEffect(() => {
    const normalizados = construirParametros({
      fecha,
      pacienteId,
      profesionalId,
      estado,
      todas,
    });

    if (normalizados.toString() !== searchParams.toString()) {
      setSearchParams(normalizados, { replace: true });
    }
  }, [
    fecha,
    pacienteId,
    profesionalId,
    estado,
    todas,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;

    const cargar = async () => {
      // Sin datos en pantalla mostramos la carga grande; con datos, un spinner
      // discreto para no vaciar la lista mientras llega la nueva fecha.
      if (hayDatos.current) {
        setActualizando(true);
      } else {
        setCargando(true);
      }

      setErrorCarga('');

      try {
        const datos = await listarCitas(
          {
            fecha: todas ? '' : fecha,
            pacienteId,
            profesionalId,
            estado,
          },
          { signal: controlador.signal },
        );

        if (!vigente) return;

        hayDatos.current = true;
        setCitas(Array.isArray(datos) ? datos : []);
      } catch (error) {
        if (!vigente || error?.name === 'AbortError') return;

        hayDatos.current = false;
        setCitas([]);
        setErrorCarga(
          error?.mensaje ||
            'No se pudieron cargar las citas. Inténtalo de nuevo.',
        );
      } finally {
        if (vigente) {
          setCargando(false);
          setActualizando(false);
        }
      }
    };

    cargar();

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [fecha, pacienteId, profesionalId, estado, todas, version]);

  useEffect(() => {
    if (!pacienteId) return undefined;

    const controlador = new AbortController();
    let vigente = true;

    obtenerPaciente(pacienteId, { signal: controlador.signal })
      .then((paciente) => {
        if (vigente) {
          setConsultaPaciente({ id: pacienteId, paciente, error: '' });
        }
      })
      .catch((error) => {
        if (!vigente || error?.name === 'AbortError') return;

        setConsultaPaciente({
          id: pacienteId,
          paciente: null,
          error:
            error?.status === 404
              ? 'El paciente seleccionado ya no existe.'
              : 'No se pudo cargar el paciente del filtro.',
        });
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [pacienteId]);

  useEffect(() => {
    const controlador = new AbortController();

    listarProfesionales({ signal: controlador.signal })
      .then((lista) => {
        const ordenados = (Array.isArray(lista) ? [...lista] : []).sort((a, b) =>
          nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'),
        );

        setProfesionales(ordenados);
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setErrorProfesionales(
          error?.mensaje || 'No se pudo cargar el catálogo de profesionales.',
        );
      });

    return () => controlador.abort();
  }, []);

  const actualizarParametros = (
    cambios,
    { modoTodas = todas, fechaDestino = fecha } = {},
  ) => {
    const siguientes = new URLSearchParams(searchParams);

    if (modoTodas) {
      siguientes.delete('fecha');
      siguientes.set('vista', 'todas');
    } else {
      siguientes.delete('vista');
      siguientes.set('fecha', fechaDestino);
    }

    Object.entries(cambios).forEach(([clave, valor]) => {
      if (valor === undefined || valor === null || valor === '') {
        siguientes.delete(clave);
      } else {
        siguientes.set(clave, String(valor));
      }
    });

    setSearchParams(siguientes);
  };

  const irA = (nuevaFecha) =>
    actualizarParametros({}, { modoTodas: false, fechaDestino: nuevaFecha });
  const irDiaAnterior = () => irA(sumarDias(fecha, -1));
  const irDiaSiguiente = () => irA(sumarDias(fecha, 1));
  const irHoy = () => irA(hoy);
  const verTodasLasFechas = () =>
    actualizarParametros({}, { modoTodas: true });
  const verPorDia = () =>
    actualizarParametros({}, { modoTodas: false, fechaDestino: fecha });

  const seleccionarPaciente = (paciente) => {
    if (paciente) {
      setConsultaPaciente({
        id: String(paciente.id),
        paciente,
        error: '',
      });
    }

    actualizarParametros({ pacienteId: paciente?.id ?? '' });
  };
  const limpiarPaciente = () => actualizarParametros({ pacienteId: '' });
  const seleccionarProfesional = (evento) =>
    actualizarParametros({ profesionalId: evento.target.value });
  const seleccionarEstado = (evento) =>
    actualizarParametros({ estado: evento.target.value });
  const limpiarFiltros = () =>
    actualizarParametros({ pacienteId: '', profesionalId: '', estado: '' });

  const resumen = construirResumen(citas);
  const grupos = todas ? agruparCitasPorFecha(citas) : [];
  const hayFiltros = Boolean(pacienteId || profesionalId || estado);
  const fechaLarga = formatearFechaLarga(fecha);
  const citaDetalle = citas.find((cita) => cita.id === detalleId) || null;

  const consultaActual =
    consultaPaciente.id === pacienteId ? consultaPaciente : null;
  const pacienteFiltro = consultaActual?.paciente || null;
  const errorPaciente = consultaActual?.error || '';

  const etiquetaPaciente = !pacienteId
    ? ''
    : pacienteFiltro
      ? nombreCompleto(pacienteFiltro)
      : `Paciente #${pacienteId}`;

  const profesionalEnCatalogo = profesionales.some(
    (profesional) => String(profesional.id) === profesionalId,
  );

  const abrirDetalle = (cita) => setDetalleId(cita.id);
  const cerrarDetalle = () => setDetalleId(null);

  const editarCita = () => {
    setDetalleId(null);
    info('La edición de citas estará disponible en el PR 7.', {
      titulo: 'Edición de citas',
    });
  };

  const etiquetaFila = (cita) => {
    const { inicio } = rangoHorario(cita);
    const dia =
      todas && esFechaValida(cita.fecha)
        ? ` el ${formatearFechaLarga(cita.fecha)}`
        : '';

    return `Ver detalle de la cita de ${nombreCompleto(
      cita.paciente,
    )}${dia} a las ${inicio || 'sin hora'}`;
  };

  const tituloVacio = hayFiltros
    ? 'Sin citas con estos filtros'
    : todas
      ? 'No hay citas registradas'
      : 'No hay citas para esta fecha';

  const descripcionVacio = hayFiltros
    ? todas
      ? 'No hay citas que coincidan con los filtros aplicados en ninguna fecha.'
      : `No hay citas que coincidan con los filtros aplicados el ${fechaLarga.toLowerCase()}.`
    : todas
      ? 'Aún no se ha registrado ninguna cita en la agenda.'
      : `No se registraron citas el ${fechaLarga.toLowerCase()}. Usa las flechas para revisar otro día.`;

  const accionVacio = hayFiltros ? (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {pacienteId && !todas ? (
        <Button
          onClick={verTodasLasFechas}
          leftIcon={<CalendarRange aria-hidden="true" />}
        >
          Ver todas las fechas
        </Button>
      ) : null}
      <Button
        variant={pacienteId && !todas ? 'secondary' : 'primary'}
        onClick={limpiarFiltros}
      >
        Limpiar filtros
      </Button>
    </div>
  ) : !todas && fecha !== hoy ? (
    <Button variant="secondary" onClick={irHoy}>
      Ir a hoy
    </Button>
  ) : null;

  const columnas = [
    {
      key: 'horario',
      header: 'Horario',
      mobileLabel: 'Horario',
      render: (cita) => {
        const { inicio, fin } = rangoHorario(cita);

        return (
          <span className="whitespace-nowrap tabular-nums">
            <span className="font-semibold text-neutral-900">
              {inicio || '—'}
            </span>
            <span className="text-neutral-500"> – {fin || '—'}</span>
          </span>
        );
      },
    },
    {
      key: 'paciente',
      header: 'Paciente',
      mobilePrimary: true,
      render: (cita) => (
        <span className="font-semibold text-neutral-900">
          {nombreCompleto(cita.paciente) || '—'}
        </span>
      ),
    },
    {
      key: 'profesional',
      header: 'Profesional',
      render: (cita) => (
        <div className="min-w-0">
          <p className="truncate text-neutral-800">
            {nombreCompleto(cita.profesional) || '—'}
          </p>
          {cita.profesional?.especialidad ? (
            <p className="truncate text-xs text-neutral-500">
              {cita.profesional.especialidad}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'servicio',
      header: 'Servicio',
      render: (cita) => {
        const { duracionMinutos } = rangoHorario(cita);

        return (
          <div className="min-w-0">
            <p className="truncate text-neutral-800">
              {cita.servicio?.nombre || '—'}
            </p>
            <p className="text-xs text-neutral-500">{duracionMinutos} min</p>
          </div>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (cita) => {
        const meta = META_ESTADO[cita.estado] || META_ESTADO.programada;

        return (
          <Badge variant={meta.variante} dot>
            {meta.etiqueta}
          </Badge>
        );
      },
    },
    {
      key: 'observaciones',
      header: 'Observaciones',
      render: (cita) =>
        cita.observaciones ? (
          <span
            className="block max-w-xs text-neutral-600"
            title={cita.observaciones}
          >
            {resumirTexto(cita.observaciones, 60)}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      key: 'detalle',
      header: null,
      headerLabel: 'Detalle',
      align: 'right',
      hideOnMobile: true,
      render: () => (
        <ChevronRight
          className="ml-auto size-4 text-neutral-400"
          aria-hidden="true"
        />
      ),
    },
  ];

  const textoResumen =
    todas && grupos.length
      ? `${resumen.total === 1 ? 'cita' : 'citas'} en ${grupos.length} ${
          grupos.length === 1 ? 'día' : 'días'
        }${hayFiltros ? ' con los filtros aplicados' : ''}`
      : `${resumen.total === 1 ? 'cita' : 'citas'} ${
          hayFiltros ? 'con los filtros aplicados' : 'en la agenda'
        }`;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Consulta las citas por día o en todas las fechas, y filtra por paciente, profesional o estado."
      />

      <div className="space-y-4">
        <div className="space-y-4 rounded-card border border-neutral-200 bg-white p-4 shadow-card sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <span id="agenda-vista-label" className={ETIQUETA_FILTROS}>
                  Vista
                </span>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-labelledby="agenda-vista-label"
                >
                  <Button
                    variant={todas ? 'secondary' : 'primary'}
                    onClick={verPorDia}
                    aria-pressed={!todas}
                  >
                    Día
                  </Button>
                  <Button
                    variant={todas ? 'primary' : 'secondary'}
                    onClick={verTodasLasFechas}
                    aria-pressed={todas}
                    leftIcon={<CalendarRange aria-hidden="true" />}
                  >
                    Todas las fechas
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:pb-2">
                {todas ? (
                  <CalendarRange
                    className="size-4 shrink-0 text-neutral-500"
                    aria-hidden="true"
                  />
                ) : (
                  <CalendarDays
                    className="size-4 shrink-0 text-neutral-500"
                    aria-hidden="true"
                  />
                )}
                <p className="text-sm font-semibold text-neutral-900">
                  {todas ? 'Todas las fechas' : fechaLarga}
                </p>
                {!todas && fecha === hoy ? (
                  <Badge size="sm" variant="primary">
                    Hoy
                  </Badge>
                ) : null}
                {todas ? (
                  <span className="text-sm text-neutral-500">
                    Agrupadas por día
                  </span>
                ) : null}
              </div>
            </div>

            {todas ? (
              <p className="text-sm text-neutral-600">
                Se muestran las citas de todas las fechas, de la más antigua a
                la más reciente.
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-full space-y-1.5 sm:w-auto">
                  <label htmlFor="agenda-fecha" className={ETIQUETA_FILTROS}>
                    Fecha
                  </label>
                  <Input
                    id="agenda-fecha"
                    type="date"
                    value={fecha}
                    onChange={(evento) => irA(evento.target.value || hoy)}
                    className="w-full tabular-nums sm:w-44"
                  />
                </div>

                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Cambiar de día"
                >
                  <Button
                    variant="secondary"
                    onClick={irDiaAnterior}
                    leftIcon={<ChevronLeft aria-hidden="true" />}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={irDiaSiguiente}
                    rightIcon={<ChevronRight aria-hidden="true" />}
                  >
                    Siguiente
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={irHoy}
                    disabled={fecha === hoy}
                  >
                    Hoy
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="filtro-paciente" className={ETIQUETA_FILTROS}>
                Paciente
              </label>
              <PacienteFiltro
                id="filtro-paciente"
                pacienteId={pacienteId}
                etiqueta={etiquetaPaciente}
                onSelect={seleccionarPaciente}
                onClear={limpiarPaciente}
              />
              {errorPaciente ? (
                <p className="text-xs text-danger-700">{errorPaciente}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="filtro-profesional" className={ETIQUETA_FILTROS}>
                Profesional
              </label>
              <Select
                id="filtro-profesional"
                value={profesionalId}
                onChange={seleccionarProfesional}
              >
                <option value="">Todos los profesionales</option>
                {profesionalId &&
                profesionales.length > 0 &&
                !profesionalEnCatalogo ? (
                  <option value={profesionalId}>
                    Profesional #{profesionalId}
                  </option>
                ) : null}
                {profesionales.map((profesional) => (
                  <option key={profesional.id} value={profesional.id}>
                    {nombreCompleto(profesional)}
                    {profesional.especialidad
                      ? ` · ${profesional.especialidad}`
                      : ''}
                  </option>
                ))}
              </Select>
              {errorProfesionales ? (
                <p className="text-xs text-danger-700">{errorProfesionales}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="filtro-estado" className={ETIQUETA_FILTROS}>
                Estado
              </label>
              <Select
                id="filtro-estado"
                value={estado}
                onChange={seleccionarEstado}
              >
                <option value="">Todos los estados</option>
                {ESTADOS_CITA.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={limpiarFiltros}
                disabled={!hayFiltros}
                leftIcon={<X aria-hidden="true" />}
                className="w-full"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </div>

        {!cargando && !errorCarga ? (
          <div className="flex flex-col gap-3 rounded-card border border-neutral-200 bg-white px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div
              className="flex flex-wrap items-center gap-2"
              aria-live="polite"
            >
              {actualizando ? (
                <Spinner size="sm" label="Actualizando agenda" />
              ) : null}
              <p className="text-2xl font-bold tabular-nums text-neutral-900">
                {resumen.total}
              </p>
              <p className="text-sm text-neutral-600">{textoResumen}</p>
              {!todas && resumen.inicio ? (
                <p className="text-sm text-neutral-500">
                  · {resumen.inicio} – {resumen.fin}
                </p>
              ) : null}
            </div>

            {resumen.porEstado.length ? (
              <ul
                className="flex flex-wrap items-center gap-1.5"
                aria-label="Citas por estado"
              >
                {resumen.porEstado.map((item) => (
                  <li key={item.valor}>
                    <Badge variant={item.variante} size="sm">
                      {item.etiqueta}: {item.total}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {cargando ? (
          <Table loading loadingLabel="Cargando citas…" />
        ) : errorCarga ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-700">
                <AlertTriangle className="size-6" aria-hidden="true" />
              </span>
              <div className="max-w-md space-y-1">
                <h2 className="text-base font-semibold text-neutral-900">
                  No se pudieron cargar las citas
                </h2>
                <p className="text-sm text-neutral-600">{errorCarga}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => setVersion((actual) => actual + 1)}
                leftIcon={<RefreshCw aria-hidden="true" />}
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div aria-busy={actualizando || undefined}>
            {todas && grupos.length ? (
              <div className="space-y-7">
                {grupos.map((grupo) => {
                  const id = `agenda-dia-${grupo.fecha || 'sin-fecha'}`;
                  const total = grupo.citas.length;

                  return (
                    <section
                      key={grupo.fecha || 'sin-fecha'}
                      aria-labelledby={id}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            id={id}
                            className="text-base font-semibold text-neutral-900"
                          >
                            {grupo.etiqueta}
                          </h2>
                          {grupo.fecha === hoy ? (
                            <Badge size="sm" variant="primary">
                              Hoy
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-neutral-600">
                          {total} {total === 1 ? 'cita' : 'citas'}
                        </p>
                      </div>

                      <Table
                        caption={`Citas del ${grupo.etiqueta}`}
                        columns={columnas}
                        rows={grupo.citas}
                        onRowClick={abrirDetalle}
                        rowLabel={etiquetaFila}
                      />
                    </section>
                  );
                })}
              </div>
            ) : (
              <Table
                caption={todas ? 'Todas las citas' : `Citas del ${fechaLarga}`}
                columns={columnas}
                rows={citas}
                onRowClick={abrirDetalle}
                rowLabel={etiquetaFila}
                emptyState={
                  <EmptyState
                    icon={hayFiltros ? SearchX : CalendarX2}
                    title={tituloVacio}
                    description={descripcionVacio}
                    action={accionVacio}
                  />
                }
              />
            )}
          </div>
        )}
      </div>

      {citaDetalle ? (
        <AgendaDetalleModal
          cita={citaDetalle}
          onClose={cerrarDetalle}
          onEditar={editarCita}
        />
      ) : null}
    </section>
  );
}

export default Agenda;
