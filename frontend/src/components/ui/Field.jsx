import { cloneElement, isValidElement, useId } from 'react';
import { cn } from '../../lib/cn';

/**
 * Asocia una etiqueta, una ayuda y un error a un control de formulario.
 * Inyecta `id`, `required`, `aria-invalid` y `aria-describedby` en el hijo.
 */
function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}) {
  const idGenerado = useId();
  const idControl =
    htmlFor ||
    (isValidElement(children) ? children.props.id : undefined) ||
    `campo-${idGenerado}`;
  const idError = `${idControl}-error`;
  const idHint = `${idControl}-hint`;
  const mostrarHint = Boolean(hint) && !error;
  const descripciones = [
    isValidElement(children) ? children.props['aria-describedby'] : null,
    error ? idError : null,
    mostrarHint ? idHint : null,
  ]
    .filter(Boolean)
    .join(' ');

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: idControl,
        invalid: Boolean(error) || children.props.invalid || undefined,
        'aria-invalid': error ? 'true' : children.props['aria-invalid'],
        'aria-describedby': descripciones || undefined,
        required: required || children.props.required || undefined,
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={idControl} className="block text-sm font-medium text-neutral-800">
          {label}
          {required ? (
            <span className="ml-0.5 text-danger-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {control}

      {mostrarHint ? (
        <p id={idHint} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={idError} role="alert" className="text-sm font-medium text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default Field;
