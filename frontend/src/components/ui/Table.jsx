import { cn } from '../../lib/cn';
import EmptyState from './EmptyState';
import Spinner from './Spinner';

const valorDe = (fila, columna) =>
  columna.render ? columna.render(fila) : fila[columna.key];

/**
 * Tabla de datos responsive: tabla en escritorio y tarjetas apiladas en móvil.
 * Columnas: { key, header, render?, mobileLabel?, hideOnMobile?, mobilePrimary?, align?, className? }
 */
function Table({
  columns = [],
  rows = [],
  getRowKey,
  caption,
  emptyTitle = 'Sin resultados',
  emptyMessage = 'No hay registros para mostrar.',
  emptyState,
  loading = false,
  loadingLabel = 'Cargando datos',
  className,
  rowClassName,
}) {
  const columnas = Array.isArray(columns) ? columns : [];
  const filas = Array.isArray(rows) ? rows : [];

  const claveDe = (fila, indice) => {
    if (getRowKey) return getRowKey(fila, indice);
    return fila?.id ?? indice;
  };

  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-3 rounded-card border border-neutral-200 bg-white p-10 text-sm text-neutral-600 shadow-card',
          className,
        )}
      >
        <Spinner size="md" />
        <span>{loadingLabel}</span>
      </div>
    );
  }

  if (!filas.length) {
    return (
      emptyState || (
        <EmptyState
          title={emptyTitle}
          description={emptyMessage}
          className={className}
        />
      )
    );
  }

  const columnasMovil = columnas.filter((columna) => !columna.hideOnMobile);
  const columnaPrincipal =
    columnasMovil.find((columna) => columna.mobilePrimary) || columnasMovil[0];
  const columnasSecundarias = columnasMovil.filter(
    (columna) => columna !== columnaPrincipal,
  );

  return (
    <>
      <div
        className={cn(
          'hidden overflow-hidden rounded-card border border-neutral-200 bg-white shadow-card md:block',
          className,
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-neutral-50">
              <tr>
                {columnas.map((columna) => (
                  <th
                    key={columna.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500',
                      columna.align === 'right' && 'text-right',
                      columna.headerClassName,
                    )}
                  >
                    {columna.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filas.map((fila, indice) => (
                <tr
                  key={claveDe(fila, indice)}
                  className={cn(
                    'transition-colors hover:bg-neutral-50',
                    typeof rowClassName === 'function'
                      ? rowClassName(fila)
                      : rowClassName,
                  )}
                >
                  {columnas.map((columna) => (
                    <td
                      key={columna.key}
                      className={cn(
                        'px-4 py-3 align-middle text-neutral-700',
                        columna.align === 'right' && 'text-right',
                        columna.className,
                      )}
                    >
                      {valorDe(fila, columna)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption || 'Registros'}>
        {filas.map((fila, indice) => (
          <li
            key={claveDe(fila, indice)}
            className={cn(
              'rounded-card border border-neutral-200 bg-white p-4 shadow-card',
              typeof rowClassName === 'function' ? rowClassName(fila) : rowClassName,
            )}
          >
            <div className="min-w-0 text-sm font-semibold text-neutral-900">
              {columnaPrincipal ? valorDe(fila, columnaPrincipal) : null}
            </div>

            {columnasSecundarias.length ? (
              <dl className="mt-3 grid gap-2 border-t border-neutral-100 pt-3 sm:grid-cols-2">
                {columnasSecundarias.map((columna) => (
                  <div key={columna.key} className="min-w-0">
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-neutral-500">
                      {columna.mobileLabel || columna.header}
                    </dt>
                    <dd className="mt-0.5 break-words text-sm text-neutral-700">
                      {valorDe(fila, columna)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export default Table;
