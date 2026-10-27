import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { cn } from '../lib/cn';
import {
  LIMITE_PACIENTES,
  formatearFecha,
  formatearTelefono,
  nombreCompleto,
} from '../lib/pacientes';
import { eliminarPaciente, listarPacientes } from '../services/pacientes';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Spinner from '../components/ui/Spinner';
import Table from '../components/ui/Table';
import PacienteDetalleModal from '../components/pacientes/PacienteDetalleModal';
import PacienteFormModal from '../components/pacientes/PacienteFormModal';

const RETRASO_BUSQUEDA = 300;

function BotonAccion({ etiqueta, onClick, icono: Icono, peligro = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-field text-neutral-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        peligro
          ? 'hover:bg-danger-50 hover:text-danger-700'
          : 'hover:bg-neutral-100 hover:text-neutral-900',
      )}
    >
      <Icono className="size-4" aria-hidden="true" />
    </button>
  );
}

function Pacientes() {
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtros, setFiltros] = useState({ buscar: '', pagina: 1 });
  const [pacientes, setPacientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [version, setVersion] = useState(0);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [pacienteEnEdicion, setPacienteEnEdicion] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [pacienteAEliminar, setPacienteAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  const primeraCarga = useRef(true);
  const navigate = useNavigate();
  const { exito, error: toastError } = useToast();

  useEffect(() => {
    const termino = textoBusqueda.trim();

    const temporizador = window.setTimeout(() => {
      setFiltros((actuales) =>
        actuales.buscar === termino
          ? actuales
          : { buscar: termino, pagina: 1 },
      );
    }, RETRASO_BUSQUEDA);

    return () => window.clearTimeout(temporizador);
  }, [textoBusqueda]);

  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;

    const cargar = async () => {
      if (primeraCarga.current) {
        setCargando(true);
      } else {
        setActualizando(true);
      }

      setErrorCarga('');

      try {
        const resultado = await listarPacientes(
          {
            buscar: filtros.buscar,
            pagina: filtros.pagina,
            limite: LIMITE_PACIENTES,
          },
          { signal: controlador.signal },
        );

        if (!vigente) return;

        setPacientes(Array.isArray(resultado?.datos) ? resultado.datos : []);
        setTotal(Number(resultado?.total) || 0);
      } catch (error) {
        if (!vigente || error?.name === 'AbortError') return;

        setErrorCarga(
          error?.mensaje || 'No se pudieron cargar los pacientes. Inténtalo de nuevo.',
        );
      } finally {
        if (vigente) {
          primeraCarga.current = false;
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
  }, [filtros, version]);

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_PACIENTES));
  const pagina = Math.min(filtros.pagina, totalPaginas);
  const desde = total === 0 ? 0 : (pagina - 1) * LIMITE_PACIENTES + 1;
  const hasta = Math.min(pagina * LIMITE_PACIENTES, total);
  const hayBusqueda = filtros.buscar.length > 0;
  const detalle = pacientes.find((paciente) => paciente.id === detalleId) || null;

  const recargar = () => setVersion((actual) => actual + 1);

  const limpiarBusqueda = () => {
    setTextoBusqueda('');
    setFiltros((actuales) =>
      actuales.buscar || actuales.pagina !== 1
        ? { buscar: '', pagina: 1 }
        : actuales,
    );
  };

  const abrirNuevo = () => {
    setPacienteEnEdicion(null);
    setFormularioAbierto(true);
  };

  const abrirEdicion = (paciente) => {
    setPacienteEnEdicion(paciente);
    setFormularioAbierto(true);
  };

  const cerrarFormulario = () => {
    setFormularioAbierto(false);
    setPacienteEnEdicion(null);
  };

  const manejarGuardado = (pacienteGuardado, esEdicion) => {
    cerrarFormulario();
    recargar();

    exito(
      esEdicion
        ? 'Los cambios se guardaron correctamente.'
        : `${nombreCompleto(pacienteGuardado)} se registró correctamente.`,
      { titulo: esEdicion ? 'Paciente actualizado' : 'Paciente creado' },
    );
  };

  const abrirEliminar = (paciente) => {
    setErrorEliminar('');
    setPacienteAEliminar(paciente);
  };

  const cerrarEliminar = () => {
    if (eliminando) return;
    setPacienteAEliminar(null);
    setErrorEliminar('');
  };

  const confirmarEliminar = async () => {
    if (!pacienteAEliminar) return;

    setEliminando(true);
    setErrorEliminar('');

    try {
      await eliminarPaciente(pacienteAEliminar.id);

      const nombre = nombreCompleto(pacienteAEliminar);
      setPacienteAEliminar(null);

      exito(`${nombre} se eliminó correctamente.`, {
        titulo: 'Paciente eliminado',
      });

      if (pacientes.length === 1 && filtros.pagina > 1) {
        setFiltros((actuales) => ({
          ...actuales,
          pagina: actuales.pagina - 1,
        }));
      } else {
        recargar();
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;

      const mensaje = error?.mensaje || 'No se pudo eliminar el paciente.';
      setErrorEliminar(mensaje);

      if (error?.status !== 409) {
        toastError(mensaje, { titulo: 'No se pudo eliminar' });
      }
    } finally {
      setEliminando(false);
    }
  };

  const irPaginaAnterior = () =>
    setFiltros((actuales) => ({
      ...actuales,
      pagina: Math.max(1, actuales.pagina - 1),
    }));

  const irPaginaSiguiente = () =>
    setFiltros((actuales) => ({
      ...actuales,
      pagina: Math.min(totalPaginas, actuales.pagina + 1),
    }));

  const verAgenda = (paciente) => {
    setDetalleId(null);
    navigate(`/agenda?pacienteId=${paciente.id}`);
  };

  const verTodasLasCitas = (paciente) => {
    setDetalleId(null);
    navigate(`/agenda?vista=todas&pacienteId=${paciente.id}`);
  };

  const columnas = [
    {
      key: 'nombre',
      header: 'Paciente',
      mobilePrimary: true,
      render: (paciente) => (
        <span className="font-semibold text-neutral-900">
          {nombreCompleto(paciente)}
        </span>
      ),
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (paciente) => (
        <span className="whitespace-nowrap tabular-nums text-neutral-700">
          {formatearTelefono(paciente.telefono)}
        </span>
      ),
    },
    {
      key: 'correo',
      header: 'Correo',
      render: (paciente) =>
        paciente.correo ? (
          <a
            href={`mailto:${paciente.correo}`}
            className="break-all text-primary-700 underline-offset-2 hover:underline"
          >
            {paciente.correo}
          </a>
        ) : (
          <span className="text-neutral-500">—</span>
        ),
    },
    {
      key: 'fechaNacimiento',
      header: 'Nacimiento',
      mobileLabel: 'Fecha de nacimiento',
      render: (paciente) => (
        <span className="whitespace-nowrap text-neutral-700">
          {formatearFecha(paciente.fechaNacimiento)}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (paciente) => {
        const nombre = nombreCompleto(paciente);

        return (
          <div className="flex items-center justify-end gap-1">
            <BotonAccion
              etiqueta={`Ver ficha de ${nombre}`}
              icono={Eye}
              onClick={() => setDetalleId(paciente.id)}
            />
            <BotonAccion
              etiqueta={`Editar a ${nombre}`}
              icono={Pencil}
              onClick={() => abrirEdicion(paciente)}
            />
            <BotonAccion
              etiqueta={`Eliminar a ${nombre}`}
              icono={Trash2}
              onClick={() => abrirEliminar(paciente)}
              peligro
            />
          </div>
        );
      },
    },
  ];

  const resumen =
    total === 0
      ? hayBusqueda
        ? 'Sin coincidencias'
        : 'Aún no hay pacientes registrados'
      : `Mostrando ${desde}–${hasta} de ${total} ${
          total === 1 ? 'paciente' : 'pacientes'
        }`;

  const mensajeEstado = cargando
    ? 'Cargando pacientes…'
    : errorCarga && pacientes.length === 0
      ? 'No se pudieron cargar los pacientes'
      : resumen;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Pacientes"
        description="Consulta, registra y actualiza los datos de contacto de los pacientes."
        actions={
          <Button onClick={abrirNuevo} leftIcon={<Plus aria-hidden="true" />}>
            Nuevo paciente
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <label htmlFor="buscar-pacientes" className="sr-only">
              Buscar pacientes
            </label>
            <Input
              id="buscar-pacientes"
              type="search"
              value={textoBusqueda}
              onChange={(evento) => setTextoBusqueda(evento.target.value)}
              placeholder="Buscar por nombre, correo o teléfono"
              autoComplete="off"
              enterKeyHint="search"
              className="[&::-webkit-search-cancel-button]:appearance-none"
              startAdornment={<Search className="size-4" aria-hidden="true" />}
              endAdornment={
                textoBusqueda ? (
                  <button
                    type="button"
                    onClick={limpiarBusqueda}
                    aria-label="Limpiar búsqueda"
                    className="flex size-8 items-center justify-center rounded-field text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null
              }
            />
          </div>

          <div
            className="flex items-center gap-2 text-sm text-neutral-600"
            aria-live="polite"
          >
            {actualizando ? (
              <Spinner size="sm" label="Actualizando pacientes" />
            ) : null}
            <p>{mensajeEstado}</p>
          </div>
        </div>

        {errorCarga && pacientes.length > 0 ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-card border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-warning-700"
                aria-hidden="true"
              />
              <span>{errorCarga}</span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={recargar}
              leftIcon={<RefreshCw aria-hidden="true" />}
            >
              Reintentar
            </Button>
          </div>
        ) : null}

        {cargando ? (
          <Table loading loadingLabel="Cargando pacientes…" />
        ) : errorCarga && pacientes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-700">
                <AlertTriangle className="size-6" aria-hidden="true" />
              </span>
              <div className="max-w-md space-y-1">
                <h2 className="text-base font-semibold text-neutral-900">
                  No se pudieron cargar los pacientes
                </h2>
                <p className="text-sm text-neutral-600">{errorCarga}</p>
              </div>
              <Button
                variant="secondary"
                onClick={recargar}
                leftIcon={<RefreshCw aria-hidden="true" />}
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div aria-busy={actualizando || undefined}>
            <Table
              caption="Pacientes registrados"
              columns={columnas}
              rows={pacientes}
              emptyState={
                <EmptyState
                  icon={hayBusqueda ? SearchX : Users}
                  title={hayBusqueda ? 'Sin coincidencias' : 'Aún no hay pacientes'}
                  description={
                    hayBusqueda
                      ? `No encontramos pacientes para “${filtros.buscar}”. Prueba con otro nombre, correo o teléfono.`
                      : 'Registra al primer paciente para empezar a gestionar sus datos y su agenda.'
                  }
                  action={
                    hayBusqueda ? (
                      <Button variant="secondary" onClick={limpiarBusqueda}>
                        Limpiar búsqueda
                      </Button>
                    ) : (
                      <Button
                        onClick={abrirNuevo}
                        leftIcon={<Plus aria-hidden="true" />}
                      >
                        Nuevo paciente
                      </Button>
                    )
                  }
                />
              }
            />
          </div>
        )}

        {!cargando && !errorCarga && total > 0 ? (
          <nav
            aria-label="Paginación de pacientes"
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-neutral-600">
              Página{' '}
              <span className="font-semibold text-neutral-900">{pagina}</span> de{' '}
              {totalPaginas}
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={irPaginaAnterior}
                disabled={pagina <= 1 || actualizando}
                leftIcon={<ChevronLeft aria-hidden="true" />}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={irPaginaSiguiente}
                disabled={pagina >= totalPaginas || actualizando}
                rightIcon={<ChevronRight aria-hidden="true" />}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        ) : null}
      </div>

      {formularioAbierto ? (
        <PacienteFormModal
          paciente={pacienteEnEdicion}
          onClose={cerrarFormulario}
          onSaved={manejarGuardado}
        />
      ) : null}

      {detalle ? (
        <PacienteDetalleModal
          paciente={detalle}
          onClose={() => setDetalleId(null)}
          onVerAgenda={verAgenda}
          onVerTodasLasCitas={verTodasLasCitas}
        />
      ) : null}

      {pacienteAEliminar ? (
        <ConfirmDialog
          open
          onClose={cerrarEliminar}
          onConfirm={confirmarEliminar}
          title="Eliminar paciente"
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar paciente"
          isLoading={eliminando}
        >
          <div className="space-y-3">
            <p className="text-sm text-neutral-700">
              ¿Seguro que quieres eliminar a{' '}
              <strong className="font-semibold text-neutral-900">
                {nombreCompleto(pacienteAEliminar)}
              </strong>
              ?
            </p>
            <p className="text-xs text-neutral-500">
              Si el paciente tiene citas o solicitudes registradas, el sistema
              impedirá la eliminación.
            </p>

            {errorEliminar ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-field border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-800"
              >
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0 text-danger-600"
                  aria-hidden="true"
                />
                <p>{errorEliminar}</p>
              </div>
            ) : null}
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

export default Pacientes;
