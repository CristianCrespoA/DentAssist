import { cn } from '../../lib/cn';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-card border border-neutral-200 bg-white shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn('border-b border-neutral-200 px-5 py-4 sm:px-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ as: Componente = 'h2', className, ...props }) {
  return (
    <Componente
      className={cn('text-base font-semibold text-neutral-900', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('mt-1 text-sm text-neutral-500', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 py-4 sm:px-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-b-card border-t border-neutral-200 bg-neutral-50/70 px-5 py-3 sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

export default Card;
