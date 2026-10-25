import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const clasesBase =
  'block h-10 w-full rounded-field border bg-white px-3 text-sm text-neutral-900 shadow-xs transition-colors placeholder:text-neutral-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500';

const Input = forwardRef(function Input(
  { type = 'text', invalid = false, className, endAdornment, ...props },
  ref,
) {
  const campo = (
    <input
      {...props}
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        clasesBase,
        invalid
          ? 'border-danger-400 focus:border-danger-600 focus:ring-danger-500/40'
          : 'border-neutral-400 focus:border-primary-600 focus:ring-primary-600/40',
        endAdornment && 'pr-12',
        className,
      )}
    />
  );

  if (!endAdornment) return campo;

  return (
    <div className="relative">
      {campo}
      <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">
        {endAdornment}
      </div>
    </div>
  );
});

export default Input;
