import { Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';

function EmptyState({
  icon: Icono = Inbox,
  title,
  description,
  action,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-neutral-300 bg-white px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <Icono className="size-6" aria-hidden="true" />
      </span>
      <div className="max-w-md space-y-1">
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {description ? (
          <p className="text-sm text-neutral-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
