import { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import Spinner from './Spinner';

const variantes = {
  primary:
    'bg-primary-700 text-white shadow-xs hover:bg-primary-800 active:bg-primary-900 disabled:hover:bg-primary-700',
  secondary:
    'border border-neutral-400 bg-white text-neutral-700 shadow-xs hover:bg-neutral-50 active:bg-neutral-100 disabled:hover:bg-white',
  ghost:
    'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:hover:bg-transparent',
  danger:
    'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-800 disabled:hover:bg-danger-600',
  success:
    'bg-success-700 text-white shadow-xs hover:bg-success-800 active:bg-success-900 disabled:hover:bg-success-700',
  link: 'h-auto px-0 text-primary-700 underline-offset-4 hover:underline',
};

const tamanos = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'size-10 p-0',
};

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    type = 'button',
    className,
    children,
    leftIcon,
    rightIcon,
    isLoading = false,
    loadingLabel = 'Cargando…',
    fullWidth = false,
    disabled,
    ...props
  },
  ref,
) {
  const esSoloIcono = size === 'icon';
  const estaDeshabilitado = disabled || isLoading;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={estaDeshabilitado}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-field font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600',
        'disabled:cursor-not-allowed disabled:opacity-60',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        variantes[variant] || variantes.primary,
        tamanos[size] || tamanos.md,
        fullWidth && 'w-full',
        className,
      )}
    >
      {isLoading ? (
        <>
          <Spinner size="sm" label={null} />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <>
          {leftIcon}
          {!esSoloIcono && children}
          {rightIcon}
        </>
      )}
    </button>
  );
});

export default Button;
