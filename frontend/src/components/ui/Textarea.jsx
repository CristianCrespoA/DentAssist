import { forwardRef } from 'react';
import { cn } from '../../lib/cn';

const Textarea = forwardRef(function Textarea(
  { invalid = false, className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      {...props}
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'block min-h-24 w-full resize-y rounded-field border bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs transition-colors placeholder:text-neutral-500 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
        invalid
          ? 'border-danger-400 focus:border-danger-600 focus:ring-danger-500/40'
          : 'border-neutral-400 focus:border-primary-600 focus:ring-primary-600/40',
        className,
      )}
    />
  );
});

export default Textarea;
