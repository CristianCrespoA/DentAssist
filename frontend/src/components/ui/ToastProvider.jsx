import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from 'lucide-react';
import { ToastContext } from '../../context/toastContextBase';
import { cn } from '../../lib/cn';

const DURACION_PREDETERMINADA = 5000;
const MAXIMO_VISIBLES = 4;

const variantes = {
  success: {
    Icono: CheckCircle2,
    contenedor: 'border-success-200',
    icono: 'text-success-600',
    titulo: 'text-success-900',
  },
  error: {
    Icono: XCircle,
    contenedor: 'border-danger-200',
    icono: 'text-danger-600',
    titulo: 'text-danger-900',
  },
  warning: {
    Icono: AlertTriangle,
    contenedor: 'border-warning-200',
    icono: 'text-warning-600',
    titulo: 'text-warning-900',
  },
  info: {
    Icono: Info,
    contenedor: 'border-primary-200',
    icono: 'text-primary-700',
    titulo: 'text-primary-900',
  },
};

let secuencia = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const temporizadores = useRef(new Map());

  const cerrar = useCallback((id) => {
    setToasts((actuales) => actuales.filter((toast) => toast.id !== id));

    const temporizador = temporizadores.current.get(id);
    if (temporizador) {
      window.clearTimeout(temporizador);
      temporizadores.current.delete(id);
    }
  }, []);

  const mostrar = useCallback(
    (mensaje, { variante = 'info', titulo, duracion = DURACION_PREDETERMINADA } = {}) => {
      const id = ++secuencia;

      setToasts((actuales) =>
        [...actuales, { id, mensaje, titulo, variante }].slice(-MAXIMO_VISIBLES),
      );

      if (duracion > 0) {
        const temporizador = window.setTimeout(() => cerrar(id), duracion);
        temporizadores.current.set(id, temporizador);
      }

      return id;
    },
    [cerrar],
  );

  useEffect(() => {
    const pendientes = temporizadores.current;

    return () => {
      pendientes.forEach((temporizador) => window.clearTimeout(temporizador));
      pendientes.clear();
    };
  }, []);

  const valor = useMemo(
    () => ({
      mostrar,
      cerrar,
      exito: (mensaje, opciones) =>
        mostrar(mensaje, { ...opciones, variante: 'success' }),
      error: (mensaje, opciones) =>
        mostrar(mensaje, { ...opciones, variante: 'error' }),
      advertencia: (mensaje, opciones) =>
        mostrar(mensaje, { ...opciones, variante: 'warning' }),
      info: (mensaje, opciones) =>
        mostrar(mensaje, { ...opciones, variante: 'info' }),
    }),
    [mostrar, cerrar],
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:max-w-sm sm:items-end sm:p-6">
        {toasts.map((toast) => {
          const estilo = variantes[toast.variante] || variantes.info;
          const { Icono } = estilo;

          return (
            <div
              key={toast.id}
              role={toast.variante === 'error' ? 'alert' : 'status'}
              aria-atomic="true"
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-card border bg-white p-4 shadow-float',
                estilo.contenedor,
              )}
            >
              <Icono
                className={cn('mt-0.5 size-5 shrink-0', estilo.icono)}
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                {toast.titulo ? (
                  <p className={cn('text-sm font-semibold', estilo.titulo)}>
                    {toast.titulo}
                  </p>
                ) : null}
                <p className="text-sm text-neutral-700">{toast.mensaje}</p>
              </div>

              <button
                type="button"
                onClick={() => cerrar(toast.id)}
                aria-label="Cerrar notificación"
                className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-field text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
