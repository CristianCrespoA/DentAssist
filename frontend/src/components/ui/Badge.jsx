import { cn } from '../../lib/cn';

const variantes = {
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  primary: 'bg-primary-50 text-primary-800 ring-primary-200',
  success: 'bg-success-50 text-success-800 ring-success-200',
  warning: 'bg-warning-50 text-warning-800 ring-warning-200',
  danger: 'bg-danger-50 text-danger-800 ring-danger-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
};

const tamanos = {
  sm: 'px-2 py-0.5 text-[0.6875rem]',
  md: 'px-2.5 py-0.5 text-xs',
};

function Badge({ variant = 'neutral', size = 'md', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset',
        variantes[variant] || variantes.neutral,
        tamanos[size] || tamanos.md,
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export default Badge;
