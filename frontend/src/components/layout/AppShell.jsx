import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import {
  CalendarDays,
  ClipboardList,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/cn';
import Badge from '../ui/Badge';
import Button from '../ui/Button';


const ETIQUETAS_ROL = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
};

const NAVEGACION = [
  {
    to: '/agenda',
    label: 'Agenda',
    descripcion: 'Citas y disponibilidad',
    Icono: CalendarDays,
  },
  {
    to: '/pacientes',
    label: 'Pacientes',
    descripcion: 'Datos y contacto',
    Icono: Users,
  },
  {
    to: '/solicitudes',
    label: 'Solicitudes',
    descripcion: 'Peticiones por WhatsApp',
    Icono: ClipboardList,
  },
  {
    to: '/usuarios',
    label: 'Usuarios',
    descripcion: 'Crear recepcionistas',
    Icono: Users,
    requiereAdmin: true,
  },
];

const obtenerIniciales = (nombre = '') =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('')
    .toUpperCase() || 'DA';

function SidebarContent({ usuario, etiquetaRol, iniciales, onLogout, onNavigate, onClose }) {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-900">
      <div className="flex h-16 items-center justify-between gap-3 border-b border-neutral-200 px-5 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-field bg-primary-700 text-white shadow-xs">
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C7.5 2 5 5 5 8c0 2 1 3.5 2 4.5.5.5 1 1 1 1.5v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1c0-.5.5-1 1-1.5 1-1 2-2.5 2-4.5 0-3-2.5-6-7-6zm-2 13v1h4v-1H10zm-1 2h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1z"/>
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              DentAssist
            </p>
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">Clínica dental</p>
          </div>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de navegación"
            className="flex size-9 shrink-0 items-center justify-center rounded-field text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Navegación principal"
        className="flex-1 space-y-1 overflow-y-auto p-3"
      >
        {NAVEGACION.filter((item) => !item.requiereAdmin || usuario?.rol === 'admin').map(({ to, label, descripcion, Icono }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-800'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-field transition-colors',
                    isActive
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-neutral-100 text-neutral-500 group-hover:bg-white group-hover:text-neutral-700',
                  )}
                >
                  <Icono className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label}</span>
                  <span
                    className={cn(
                      'block truncate text-xs font-normal',
                      isActive ? 'text-primary-700' : 'text-neutral-500',
                    )}
                  >
                    {descripcion}
                  </span>
                </span>
                {isActive ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-primary-600"
                    aria-hidden="true"
                  />
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-center gap-3 rounded-field bg-neutral-50 p-3 dark:bg-neutral-800">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800 dark:bg-primary-900 dark:text-primary-200"
            aria-hidden="true"
          >
            {iniciales}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {usuario?.nombre || 'Personal de la clínica'}
            </p>
            <div className="mt-1">
              <Badge
                size="sm"
                variant={usuario?.rol === 'admin' ? 'primary' : 'neutral'}
              >
                {etiquetaRol}
              </Badge>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          onClick={onLogout}
          leftIcon={<LogOut aria-hidden="true" />}
          className="mt-2 w-full justify-start"
        >
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

function AppShell() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const mainRef = useRef(null);

  const etiquetaRol = ETIQUETAS_ROL[usuario?.rol] || usuario?.rol || 'Personal';
  const iniciales = obtenerIniciales(usuario?.nombre);

  const manejarSalida = () => {
    setMenuAbierto(false);
    logout();
    navigate('/login', { replace: true });
  };

  const cerrarMenu = () => setMenuAbierto(false);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-field focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-800 focus:shadow-float dark:bg-neutral-900 dark:text-primary-200"
      >
        Saltar al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-sidebar border-r border-neutral-200 bg-white lg:block dark:border-neutral-800 dark:bg-neutral-900">
        <SidebarContent
          usuario={usuario}
          etiquetaRol={etiquetaRol}
          iniciales={iniciales}
          onLogout={manejarSalida}
        />
      </aside>

      <Dialog
        open={menuAbierto}
        onClose={cerrarMenu}
        className="relative z-50 lg:hidden"
      >
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-neutral-950/50 transition data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-10 flex">
          <DialogPanel
            transition
            className="flex w-full max-w-xs flex-col bg-white shadow-float transition data-closed:-translate-x-full data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in dark:bg-neutral-900"
          >
            <DialogTitle className="sr-only">Menú de navegación</DialogTitle>
            <SidebarContent
              usuario={usuario}
              etiquetaRol={etiquetaRol}
              iniciales={iniciales}
              onLogout={manejarSalida}
              onNavigate={cerrarMenu}
              onClose={cerrarMenu}
            />
          </DialogPanel>
        </div>
      </Dialog>

      <div className="lg:pl-sidebar">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur lg:hidden dark:border-neutral-800 dark:bg-neutral-900/95">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir menú de navegación"
              onClick={() => setMenuAbierto(true)}
              leftIcon={<Menu aria-hidden="true" />}
            />
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-field bg-primary-700 text-white">
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C7.5 2 5 5 5 8c0 2 1 3.5 2 4.5.5.5 1 1 1 1.5v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-1c0-.5.5-1 1-1.5 1-1 2-2.5 2-4.5 0-3-2.5-6-7-6zm-2 13v1h4v-1H10zm-1 2h6v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1z"/>
                </svg>
              </span>
              <span className="truncate text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                DentAssist
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {usuario?.nombre}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{etiquetaRol}</p>
            </div>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-800 sm:hidden dark:bg-primary-900 dark:text-primary-200"
              aria-hidden="true"
            >
              {iniciales}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar sesión"
              onClick={manejarSalida}
              leftIcon={<LogOut aria-hidden="true" />}
            />
          </div>
        </header>

        <main
          ref={mainRef}
          id="contenido-principal"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
