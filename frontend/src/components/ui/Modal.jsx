import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

const tamanos = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Diálogo accesible basado en Headless UI: cierra con Esc, atrapa el foco,
 * bloquea el scroll y anuncia el título/descripción a lectores de pantalla.
 */
function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  role = 'dialog',
  initialFocus,
  showCloseButton = true,
  className,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      role={role}
      initialFocus={initialFocus}
      className="relative z-50"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-neutral-950/50 backdrop-blur-xs transition data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in"
      />

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto p-4 sm:p-6">
        <div className="flex min-h-full items-end justify-center sm:items-center">
          <DialogPanel
            transition
            className={cn(
              'relative w-full transform rounded-dialog bg-white text-left shadow-float transition data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-200 data-enter:ease-out data-leave:duration-150 data-leave:ease-in sm:data-closed:translate-y-0 sm:data-closed:scale-95',
              tamanos[size] || tamanos.md,
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold text-neutral-900">
                  {title}
                </DialogTitle>
                {description ? (
                  <Description className="mt-1 text-sm text-neutral-600">
                    {description}
                  </Description>
                ) : null}
              </div>

              {showCloseButton ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-field text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {children ? (
              <div className="px-5 py-5 sm:px-6">{children}</div>
            ) : null}

            {footer ? (
              <div className="flex flex-col-reverse gap-2 rounded-b-dialog border-t border-neutral-200 bg-neutral-50/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                {footer}
              </div>
            ) : null}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

export default Modal;
