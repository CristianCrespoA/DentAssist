import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatearTelefono, nombreCompleto } from '../../lib/pacientes';
import { listarPacientes } from '../../services/pacientes';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';

const RETRASO_BUSQUEDA = 300;
const LIMITE_RESULTADOS = 8;
const OPCION_TODOS = 'todos';

/**
 * Selector de paciente con búsqueda remota. Mantiene el foco en el buscador
 * mientras se navega con las flechas y se elige con Enter.
 */
function PacienteFiltro({
  id = 'filtro-paciente',
  pacienteId = '',
  etiqueta = '',
  onSelect,
  onClear,
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [activo, setActivo] = useState(0);
  const [intento, setIntento] = useState(0);
  const contenedorRef = useRef(null);
  const botonRef = useRef(null);
  const inputRef = useRef(null);

  const idLista = `${id}-lista`;
  const idActivo = `${id}-opcion-${activo}`;
  const haySeleccion = Boolean(pacienteId);

  const textoBoton =
    etiqueta || (haySeleccion ? 'Paciente seleccionado' : 'Todos los pacientes');

  const opciones = [
    { clave: OPCION_TODOS, etiqueta: 'Todos los pacientes', paciente: null },
    ...resultados.map((paciente) => ({
      clave: String(paciente.id),
      etiqueta: nombreCompleto(paciente),
      telefono: paciente.telefono,
      paciente,
    })),
  ];

  useEffect(() => {
    if (!abierto) return undefined;

    const controlador = new AbortController();
    let vigente = true;

    const temporizador = window.setTimeout(
      async () => {
        setCargando(true);
        setError('');

        try {
          const respuesta = await listarPacientes(
            { buscar: busqueda.trim(), pagina: 1, limite: LIMITE_RESULTADOS },
            { signal: controlador.signal },
          );

          if (!vigente) return;

          setResultados(Array.isArray(respuesta?.datos) ? respuesta.datos : []);
          setActivo(0);
        } catch (fallo) {
          if (!vigente || fallo?.name === 'AbortError') return;

          setResultados([]);
          setError(fallo?.mensaje || 'No se pudieron buscar pacientes.');
        } finally {
          if (vigente) setCargando(false);
        }
      },
      busqueda.trim() ? RETRASO_BUSQUEDA : 0,
    );

    return () => {
      vigente = false;
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [abierto, busqueda, intento]);

  useEffect(() => {
    if (!abierto) return undefined;

    const manejarClicExterior = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) {
        setAbierto(false);
        setBusqueda('');
      }
    };

    document.addEventListener('mousedown', manejarClicExterior);

    return () => document.removeEventListener('mousedown', manejarClicExterior);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    contenedorRef.current
      ?.querySelector(`[data-opcion="${activo}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [abierto, activo]);

  const cerrar = (devolverFoco = false) => {
    setAbierto(false);
    setBusqueda('');
    setCargando(false);
    if (devolverFoco) botonRef.current?.focus();
  };

  const alternar = () => {
    if (abierto) {
      cerrar(true);
    } else {
      setAbierto(true);
    }
  };

  const elegir = (opcion) => {
    if (!opcion) return;

    if (opcion.paciente) {
      onSelect?.(opcion.paciente);
    } else {
      onClear?.();
    }

    cerrar(true);
  };

  const manejarTecla = (evento) => {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      cerrar(true);
      return;
    }

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setActivo((actual) => Math.min(actual + 1, opciones.length - 1));
      return;
    }

    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setActivo((actual) => Math.max(actual - 1, 0));
      return;
    }

    if (evento.key === 'Home') {
      evento.preventDefault();
      setActivo(0);
      return;
    }

    if (evento.key === 'End') {
      evento.preventDefault();
      setActivo(opciones.length - 1);
      return;
    }

    if (evento.key === 'Enter') {
      evento.preventDefault();
      if (!cargando) elegir(opciones[activo]);
    }
  };

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={botonRef}
        id={id}
        type="button"
        onClick={alternar}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idLista : undefined}
        aria-label={`Paciente: ${textoBoton}`}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-field border border-neutral-400 bg-white px-3 text-left text-sm shadow-xs transition-colors',
          'focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/40',
          abierto && 'border-primary-600 ring-2 ring-primary-600/40',
        )}
      >
        <Search className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            haySeleccion || etiqueta ? 'text-neutral-900' : 'text-neutral-500',
          )}
        >
          {textoBoton}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-neutral-500 transition-transform',
            abierto && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {abierto ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-64 rounded-card border border-neutral-200 bg-white shadow-float">
          <div className="border-b border-neutral-200 p-2">
            <label htmlFor={`${id}-buscar`} className="sr-only">
              Buscar paciente
            </label>
            <Input
              ref={inputRef}
              id={`${id}-buscar`}
              type="search"
              role="combobox"
              aria-expanded="true"
              aria-controls={idLista}
              aria-autocomplete="list"
              aria-activedescendant={
                !cargando && opciones.length ? idActivo : undefined
              }
              autoFocus
              autoComplete="off"
              enterKeyHint="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              onKeyDown={manejarTecla}
              placeholder="Buscar por nombre, correo o teléfono"
              className="[&::-webkit-search-cancel-button]:appearance-none"
              startAdornment={<Search className="size-4" aria-hidden="true" />}
              endAdornment={
                cargando ? <Spinner size="sm" label={null} /> : undefined
              }
            />
          </div>

          <ul
            id={idLista}
            role="listbox"
            aria-label="Pacientes"
            className="max-h-64 overflow-y-auto p-1"
          >
            {error ? (
              <li className="space-y-2 px-3 py-3 text-sm text-neutral-600">
                <p className="text-danger-700">{error}</p>
                <button
                  type="button"
                  onClick={() => setIntento((actual) => actual + 1)}
                  className="font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  Reintentar
                </button>
              </li>
            ) : (
              <>
                {!cargando && resultados.length === 0 && busqueda.trim() ? (
                  <li className="px-3 py-3 text-sm text-neutral-600">
                    No encontramos pacientes para “{busqueda.trim()}”.
                  </li>
                ) : null}

                {opciones.map((opcion, indice) => {
                  const seleccionado =
                    opcion.paciente === null
                      ? !haySeleccion
                      : opcion.clave === String(Number(pacienteId));

                  return (
                    <li
                      key={opcion.clave}
                      id={`${id}-opcion-${indice}`}
                      data-opcion={indice}
                      role="option"
                      aria-selected={seleccionado}
                      onMouseEnter={() => setActivo(indice)}
                      onClick={() => elegir(opcion)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-field px-3 py-2 text-sm',
                        indice === activo
                          ? 'bg-primary-50 text-primary-900'
                          : 'text-neutral-700',
                        seleccionado && 'font-semibold',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {opcion.etiqueta}
                      </span>
                      {opcion.telefono ? (
                        <span className="shrink-0 text-xs font-normal text-neutral-500">
                          {formatearTelefono(opcion.telefono)}
                        </span>
                      ) : null}
                      {seleccionado ? (
                        <Check
                          className="size-4 shrink-0 text-primary-700"
                          aria-hidden="true"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default PacienteFiltro;
