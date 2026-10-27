import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  Play,
  RefreshCw,
  SearchX,
  X,
} from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { cn } from '../lib/cn';
import { esFechaValida, normalizarIdPositivo } from '../lib/agenda';
import { nombreCompleto } from '../lib/pacientes';
import {
  LIMITE_SOLICITUDES,
  META_TIPO,
  PESTANAS_SOLICITUD,
  TIPOS_SOLICITUD,
  estadoSolicitud,
  formatearFechaSolicitud,
  formatearHoraSolicitud,
  normalizarEstadoSolicitud,
  normalizarTipoSolicitud,
  resumenMensaje,
} from '../lib/solicitudes';
import {
  cambiarEstadoSolicitud,
  contarSolicitudes,
  listarSolicitudes,
  obtenerSolicitud,
} from '../services/solicitudes';
import { obtenerPaciente } from '../services/pacientes';
import PacienteFiltro from '../components/agenda/PacienteFiltro';
import SolicitudDetalleModal from '../components/solicitudes/SolicitudDetalleModal';
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

const idPestana = (valor) => `tab-solicitud-${valor || 'todas'}`;

function BotonAccion({ etiqueta, onClick, icono: Icono, cargando = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cargando}
      aria-label={etiqueta}
      title={etiqueta}
      className="inline-flex size-8 items-center justify-center rounded-field text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {cargando ? (
        <Spinner size="sm" label={null} />
      ) : (
        <Icono className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

function Solicitudes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { exito, error: toastError } = useToast();

  const estado = normalizarEstadoSolicitud(searchParams.get('estado'));
  const tipo = normalizarTipoSolicitud(searchParams.get('tipo'));
  const fechaParam = searchParams.get('fecha');
  const fecha = esFechaValida(fechaParam) ? fechaParam : '';
  const pacienteId = normalizarIdPositivo(searchParams.get('pacienteId'));
  const paginaParam = normalizarIdPositivo(searchParams.get('pagina'));
  const pagina = paginaParam ? Number(paginaParam) : 1;
  const detalleId = normalizarIdPositivo(searchParams.get('solicitud'));

  const [solicitudes, setSolicitudes] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [version, setVersion] = useState(0);

  const [contadores, setContadores] = useState(null);
  const [cargandoContadores, setCargandoContadores] = useState(true);
  const [errorContadores, setErrorContadores] = useState('');

  const [consultaPaciente, setConsultaPaciente] = useState({
    id: '',
    paciente: null,
    error: '',
  });

  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [intentoDetalle, setIntentoDetalle] = useState(0);

  const [accionRapidaId, setAccionRapidaId] = useState(null);

  const pestanasRef = useRef([]);
  const claveCargada = useRef('');

  // La URL es la fuente de verdad: se descartan valores inválidos y parámetros
  // desconocidos para que refrescar o compartir el enlace conserve la vista.
  useEffect(() => {
    const normalizados = new URLSearchParams();

    if (estado) normalizados.set('estado', estado);
    if (tipo) normalizados.set('tipo', tipo);
    if (fecha) normalizados.set('fecha', fecha);
    if (pacienteId) normalizados.set('pacienteId', pacienteId);
    if (pagina > 1) normalizados.set('pagina', String(pagina));
    if (detalleId) normalizados.set('solicitud', detalleId);

    if (normalizados.toString() !== searchParams.toString()) {
      setSearchParams(normalizados, { replace: true });
    }
  }, [
    estado,
    tipo,
    fecha,
    pacienteId,
    pagina,
    detalleId,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;
    const clave = [estado, tipo, fecha, pacienteId, pagina].join('|');
    const cambioConsulta = claveCargada.current !== clave;

    claveCargada.current = clave;

    if (cambioConsulta) {
      setCargando(true);
      setErrorCarga('');
    } else {
      setActualizando(true);
    }

    const cargar = async () => {
      try {
        const resultado = await listarSolicitudes(
          {
            estado,
            tipo,
            pacienteId,
            fecha,
            pagina,
            limite: LIMITE_SOLICITUDES,
          },
          { signal: controlador.signal },
        );

        if (!vigente) return;

        const datos = Array.isArray(resultado?.datos) ? resultado.datos : [];
        const totalResultado = Number(resultado?.total) || 0;
        const totalPaginas = Math.max(
          1,
          Math.ceil(totalResultado / LIMITE_SOLICITUDES),
        );

        setSolicitudes(datos);
        setTotal(totalResultado);
        setErrorCarga('');

        // Si la página quedó fuera de rango tras resolver la última solicitud,
        // se vuelve a la última página con resultados.
        if (pagina > totalPaginas) {
          const siguientes = new URLSearchParams(searchParams);

          if (totalPaginas > 1) {
            siguientes.set('pagina', String(totalPaginas));
          } else {
            siguientes.delete('pagina');
          }

          setSearchParams(siguientes, { replace: true });
        }
      } catch (error) {
        if (!vigente || error?.name === 'AbortError') return;

        setSolicitudes([]);
        setTotal(0);
        setErrorCarga(
          error?.mensaje ||
            'No se pudieron cargar las solicitudes. Inténtalo de nuevo.',
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
    // `searchParams` y `setSearchParams` solo se usan para corregir la página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, tipo, fecha, pacienteId, pagina, version]);

  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;

    const cargar = async () => {
      setCargandoContadores(true);
      setErrorContadores('');

      try {
        const resultado = await contarSolicitudes(
          { tipo, pacienteId, fecha },
          { signal: controlador.signal },
        );

        if (vigente) setContadores(resultado);
      } catch (error) {
        if (!vigente || error?.name === 'AbortError') return;

        setErrorContadores(
          error?.mensaje || 'No se pudieron actualizar los contadores.',
        );
      } finally {
        if (vigente) setCargandoContadores(false);
      }
    };

    cargar();

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [tipo, pacienteId, fecha, version]);

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
    if (!detalleId) return undefined;

    const controlador = new AbortController();
    let vigente = true;

    const cargar = async () => {
      setDetalle(null);
      setErrorDetalle('');
      setCargandoDetalle(true);

      try {
        const solicitud = await obtenerSolicitud(detalleId, {
          signal: controlador.signal,
        });

        if (vigente) setDetalle(solicitud);
      } catch (error) {
        if (!vigente || error?.name === 'AbortError') return;

        setDetalle(null);
        setErrorDetalle(
          error?.status === 404
            ? 'La solicitud ya no existe.'
            : error?.mensaje || 'No se pudo cargar la solicitud.',
        );
      } finally {
        if (vigente) setCargandoDetalle(false);
      }
    };

    cargar();

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [detalleId, intentoDetalle]);

  const actualizarParametros = (cambios) => {
    const siguientes = new URLSearchParams(searchParams);

    Object.entries(cambios).forEach(([clave, valor]) => {
      if (valor === undefined || valor === null || valor === '') {
        siguientes.delete(clave);
      } else {
        siguientes.set(clave, String(valor));
      }
    });

    setSearchParams(siguientes);
  };

  const seleccionarPestana = (valor) => {
    if ((estado || '') === valor) return;
    actualizarParametros({ estado: valor, pagina: '' });
  };

  const manejarTeclaPestana = (evento, indice) => {
    const totalPestanas = PESTANAS_SOLICITUD.length;
    let destino = null;

    if (evento.key === 'ArrowRight') destino = (indice + 1) % totalPestanas;
    if (evento.key === 'ArrowLeft')
      destino = (indice - 1 + totalPestanas) % totalPestanas;
    if (evento.key === 'Home') destino = 0;
    if (evento.key === 'End') destino = totalPestanas - 1;

    if (destino === null) return;

    evento.preventDefault();
    seleccionarPestana(PESTANAS_SOLICITUD[destino].valor);
    pestanasRef.current[destino]?.focus();
  };

  const seleccionarTipo = (evento) =>
    actualizarParametros({ tipo: evento.target.value, pagina: '' });

  const seleccionarFecha = (evento) =>
    actualizarParametros({ fecha: evento.target.value, pagina: '' });

  const quitarFecha = () => actualizarParametros({ fecha: '', pagina: '' });

  const seleccionarPaciente = (paciente) => {
    if (paciente) {
      setConsultaPaciente({
        id: String(paciente.id),
        paciente,
        error: '',
      });
    }

    actualizarParametros({ pacienteId: paciente?.id ?? '', pagina: '' });
  };

  const limpiarPaciente = () => actualizarParametros({ pacienteId: '', pagina: '' });

  const limpiarFiltros = () =>
    actualizarParametros({ tipo: '', fecha: '', pacienteId: '', pagina: '' });

  const recargar = () => setVersion((actual) => actual + 1);

  const abrirDetalle = (solicitud) =>
    actualizarParametros({ solicitud: String(solicitud.id) });

  const cerrarDetalle = () => {
    actualizarParametros({ solicitud: '' });
    setDetalle(null);
    setErrorDetalle('');
    setCargandoDetalle(false);
  };

  const manejarCambioEstado = async (id, estadoNuevo, comentario) => {
    const actualizada = await cambiarEstadoSolicitud(id, {
      estado: estadoNuevo,
      comentario,
    });

    setDetalle((actual) =>
      actual && actual.id === actualizada.id ? actualizada : actual,
    );
    setVersion((actual) => actual + 1);

    const nombre = nombreCompleto(actualizada?.paciente) || `#${id}`;

    if (estadoNuevo === 'en_atencion') {
      exito(`La solicitud de ${nombre} pasó a en atención.`, {
        titulo: 'Solicitud en atención',
      });
    } else {
      const efecto =
        actualizada?.tipo === 'cancelacion'
          ? ' La cita quedó cancelada.'
          : actualizada?.tipo === 'reprogramacion'
            ? ' La cita se movió al horario propuesto.'
            : '';

      exito(`La solicitud de ${nombre} se resolvió.${efecto}`, {
        titulo: 'Solicitud resuelta',
      });
    }

    return actualizada;
  };

  const tomarEnAtencionRapida = async (solicitud) => {
    if (accionRapidaId) return;

    setAccionRapidaId(solicitud.id);

    try {
      await manejarCambioEstado(solicitud.id, 'en_atencion');
    } catch (error) {
      if (error?.name === 'AbortError' || error?.status === 401) return;

      toastError(
        error?.mensaje || 'No se pudo tomar la solicitud. Inténtalo de nuevo.',
        { titulo: 'No se pudo actualizar' },
      );
    } finally {
      setAccionRapidaId(null);
    }
  };

  const pestañaActiva = PESTANAS_SOLICITUD.find(
    (opcion) => opcion.valor === (estado || ''),
  );
  const hayFiltros = Boolean(tipo || fecha || pacienteId);
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE_SOLICITUDES));
  const paginaActual = Math.min(pagina, totalPaginas);
  const desde = total === 0 ? 0 : (paginaActual - 1) * LIMITE_SOLICITUDES + 1;
  const hasta = Math.min(paginaActual * LIMITE_SOLICITUDES, total);

  const consultaActual =
    consultaPaciente.id === pacienteId ? consultaPaciente : null;
  const pacienteFiltro = consultaActual?.paciente || null;
  const errorPaciente = consultaActual?.error || '';
  const etiquetaPaciente = !pacienteId
    ? ''
    : pacienteFiltro
      ? nombreCompleto(pacienteFiltro)
      : `Paciente #${pacienteId}`;

  const irPaginaAnterior = () =>
    actualizarParametros({ pagina: paginaActual > 2 ? paginaActual - 1 : '' });

  const irPaginaSiguiente = () =>
    actualizarParametros({
      pagina: Math.min(totalPaginas, paginaActual + 1),
    });

  const etiquetaFila = (solicitud) =>
    `Ver detalle de la solicitud de ${
      nombreCompleto(solicitud.paciente) || 'paciente sin nombre'
    } recibida el ${formatearFechaSolicitud(solicitud.fechaSolicitud)}`;

  const columnas = [
    {
      key: 'fechaSolicitud',
      header: 'Recibida',
      render: (solicitud) => (
        <span className="whitespace-nowrap tabular-nums text-neutral-700">
          <span className="block font-medium text-neutral-900">
            {formatearFechaSolicitud(solicitud.fechaSolicitud)}
          </span>
          <span className="block text-xs text-neutral-500">
            {formatearHoraSolicitud(solicitud.fechaSolicitud)}
          </span>
        </span>
      ),
    },
    {
      key: 'paciente',
      header: 'Paciente',
      mobilePrimary: true,
      render: (solicitud) => (
        <span className="font-semibold text-neutral-900">
          {nombreCompleto(solicitud.paciente) || '—'}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (solicitud) => {
        const meta = META_TIPO[solicitud.tipo] || META_TIPO.otra;

        return (
          <Badge variant={meta.variante} size="sm">
            {meta.etiqueta}
          </Badge>
        );
      },
    },
    {
      key: 'mensaje',
      header: 'Mensaje',
      render: (solicitud) => (
        <span
          className="block max-w-xs text-neutral-600"
          title={solicitud.mensaje || undefined}
        >
          {resumenMensaje(solicitud.mensaje)}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (solicitud) => {
        const meta = estadoSolicitud(solicitud);

        return (
          <Badge variant={meta.variante} dot>
            {meta.etiqueta}
          </Badge>
        );
      },
    },
    {
      key: 'acciones',
      header: 'Acciones',
      headerLabel: 'Acciones',
      align: 'right',
      render: (solicitud) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(evento) => evento.stopPropagation()}
          onKeyDown={(evento) => evento.stopPropagation()}
        >
          <BotonAccion
            etiqueta={`Ver detalle de la solicitud de ${
              nombreCompleto(solicitud.paciente) || 'paciente'
            }`}
            icono={Eye}
            onClick={() => abrirDetalle(solicitud)}
          />
          {solicitud.estado === 'pendiente' ? (
            <BotonAccion
              etiqueta={`Tomar en atención la solicitud de ${
                nombreCompleto(solicitud.paciente) || 'paciente'
              }`}
              icono={Play}
              cargando={accionRapidaId === solicitud.id}
              onClick={() => tomarEnAtencionRapida(solicitud)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  const tituloVacio = hayFiltros
    ? 'Sin solicitudes con estos filtros'
    : estado === 'pendiente'
      ? 'No hay solicitudes pendientes'
      : estado === 'en_atencion'
        ? 'No hay solicitudes en atención'
        : estado === 'resuelta'
          ? 'No hay solicitudes resueltas'
          : 'La bandeja está vacía';

  const descripcionVacio = hayFiltros
    ? 'Ajusta el tipo, la fecha o el paciente, o limpia los filtros para ver más resultados.'
    : estado === 'pendiente'
      ? 'Cuando llegue una solicitud por WhatsApp aparecerá aquí para atenderla.'
      : estado === 'en_atencion'
        ? 'Toma una solicitud pendiente para que aparezca en esta pestaña.'
        : estado === 'resuelta'
          ? 'Las solicitudes cerradas se conservan aquí con su historial.'
          : 'Aún no se han recibido solicitudes para atender.';

  const accionVacio = hayFiltros ? (
    <Button variant="secondary" onClick={limpiarFiltros}>
      Limpiar filtros
    </Button>
  ) : estado && estado !== 'pendiente' ? (
    <Button variant="secondary" onClick={() => seleccionarPestana('pendiente')}>
      Ver pendientes
    </Button>
  ) : null;

  const resumenTexto =
    total === 0
      ? hayFiltros
        ? 'sin coincidencias'
        : 'en la bandeja'
      : `${total === 1 ? 'solicitud' : 'solicitudes'} ${
          hayFiltros ? 'con los filtros aplicados' : 'en la bandeja'
        }`;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Solicitudes"
        description="Atiende lo que llega por WhatsApp: revisa el mensaje, resuelve la cita y deja el historial."
        actions={
          <Button
            variant="secondary"
            onClick={recargar}
            disabled={cargando || actualizando}
            leftIcon={<RefreshCw aria-hidden="true" />}
          >
            Actualizar
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="rounded-card border border-neutral-200 bg-white shadow-card">
          <div className="flex flex-wrap items-end gap-2 border-b border-neutral-200 px-4 pt-3 sm:px-5">
            <div
              role="tablist"
              aria-label="Estados de las solicitudes"
              aria-busy={cargandoContadores || undefined}
              className="flex flex-wrap items-end gap-1"
            >
              {PESTANAS_SOLICITUD.map((pestana, indice) => {
                const activa = (estado || '') === pestana.valor;
                const valor = contadores?.[pestana.valor || 'todas'];
                const cargandoValor = cargandoContadores && valor === undefined;

                return (
                  <button
                    key={pestana.valor || 'todas'}
                    ref={(elemento) => {
                      pestanasRef.current[indice] = elemento;
                    }}
                    type="button"
                    role="tab"
                    id={idPestana(pestana.valor)}
                    aria-selected={activa}
                    aria-controls="panel-solicitudes"
                    tabIndex={activa ? 0 : -1}
                    onClick={() => seleccionarPestana(pestana.valor)}
                    onKeyDown={(evento) => manejarTeclaPestana(evento, indice)}
                    className={cn(
                      '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary-600',
                      activa
                        ? 'border-primary-600 text-primary-800'
                        : 'border-transparent text-neutral-600 hover:text-neutral-900',
                    )}
                  >
                    {pestana.etiqueta}
                    <span
                      aria-label={
                        cargandoValor
                          ? `Cargando ${pestana.plural}`
                          : `${valor ?? 0} ${pestana.plural}`
                      }
                      className={cn(
                        'inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs tabular-nums',
                        activa
                          ? 'bg-primary-100 text-primary-800'
                          : 'bg-neutral-100 text-neutral-600',
                      )}
                    >
                      {cargandoValor ? '…' : (valor ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>

            {cargandoContadores ? (
              <span className="mb-3 ml-auto hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
                <Spinner size="sm" label="Actualizando contadores" />
                Contadores
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-4">
            <div className="space-y-1.5">
              <label htmlFor="filtro-solicitud-paciente" className={ETIQUETA_FILTROS}>
                Paciente
              </label>
              <PacienteFiltro
                id="filtro-solicitud-paciente"
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
              <label htmlFor="filtro-solicitud-tipo" className={ETIQUETA_FILTROS}>
                Tipo
              </label>
              <Select
                id="filtro-solicitud-tipo"
                value={tipo}
                onChange={seleccionarTipo}
              >
                <option value="">Todos los tipos</option>
                {TIPOS_SOLICITUD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="filtro-solicitud-fecha" className={ETIQUETA_FILTROS}>
                Fecha de recepción
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="filtro-solicitud-fecha"
                  type="date"
                  value={fecha}
                  onChange={seleccionarFecha}
                  className="flex-1 tabular-nums"
                />
                {fecha ? (
                  <button
                    type="button"
                    onClick={quitarFecha}
                    aria-label="Quitar filtro de fecha"
                    title="Quitar filtro de fecha"
                    className="flex size-8 shrink-0 items-center justify-center rounded-field text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
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

        {errorContadores ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-field border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-900"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <p>Los contadores no se pudieron actualizar.</p>
          </div>
        ) : null}

        <div
          id="panel-solicitudes"
          role="tabpanel"
          aria-labelledby={idPestana(estado)}
          className="space-y-4"
        >
          {!cargando && !errorCarga ? (
            <div className="flex flex-col gap-2 rounded-card border border-neutral-200 bg-white px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div
                className="flex flex-wrap items-center gap-2"
                aria-live="polite"
              >
                {actualizando ? (
                  <Spinner size="sm" label="Actualizando solicitudes" />
                ) : null}
                <p className="text-2xl font-bold tabular-nums text-neutral-900">
                  {total}
                </p>
                <p className="text-sm text-neutral-600">{resumenTexto}</p>
                {total > 0 ? (
                  <p className="text-sm text-neutral-500">
                    · {desde}–{hasta} de {total}
                  </p>
                ) : null}
              </div>

              {pestañaActiva ? (
                <p className="text-sm text-neutral-500">
                  Pestaña: {pestañaActiva.etiqueta}
                  {hayFiltros ? ' · filtros activos' : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          {errorCarga && solicitudes.length > 0 ? (
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
            <Table loading loadingLabel="Cargando solicitudes…" />
          ) : errorCarga && solicitudes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-danger-50 text-danger-700">
                  <AlertTriangle className="size-6" aria-hidden="true" />
                </span>
                <div className="max-w-md space-y-1">
                  <h2 className="text-base font-semibold text-neutral-900">
                    No se pudieron cargar las solicitudes
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
                caption={`Solicitudes · ${pestañaActiva?.etiqueta || 'Todas'}`}
                columns={columnas}
                rows={solicitudes}
                onRowClick={abrirDetalle}
                rowLabel={etiquetaFila}
                emptyState={
                  <EmptyState
                    icon={hayFiltros ? SearchX : ClipboardList}
                    title={tituloVacio}
                    description={descripcionVacio}
                    action={accionVacio}
                  />
                }
              />
            </div>
          )}

          {!cargando && !errorCarga && total > 0 ? (
            <nav
              aria-label="Paginación de solicitudes"
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-neutral-600">
                Página{' '}
                <span className="font-semibold text-neutral-900">
                  {paginaActual}
                </span>{' '}
                de {totalPaginas}
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={irPaginaAnterior}
                  disabled={paginaActual <= 1 || actualizando}
                  leftIcon={<ChevronLeft aria-hidden="true" />}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={irPaginaSiguiente}
                  disabled={paginaActual >= totalPaginas || actualizando}
                  rightIcon={<ChevronRight aria-hidden="true" />}
                >
                  Siguiente
                </Button>
              </div>
            </nav>
          ) : null}
        </div>
      </div>

      <SolicitudDetalleModal
        abierta={Boolean(detalleId)}
        solicitud={detalle}
        cargando={cargandoDetalle}
        error={errorDetalle}
        onReintentar={() => setIntentoDetalle((actual) => actual + 1)}
        onClose={cerrarDetalle}
        onCambiarEstado={manejarCambioEstado}
      />
    </section>
  );
}

export default Solicitudes;
