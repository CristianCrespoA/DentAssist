import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const Select = forwardRef(function Select(
  { invalid = false, className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        {...props}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'block h-10 w-full appearance-none rounded-field border bg-white px-3 pr-9 text-sm text-neutral-900 shadow-xs transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
          invalid
            ? 'border-danger-400 focus:border-danger-600 focus:ring-danger-500/40'
            : 'border-neutral-400 focus:border-primary-600 focus:ring-primary-600/40',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
        aria-hidden="true"
      />
    </div>
  );
});

export default Select;
