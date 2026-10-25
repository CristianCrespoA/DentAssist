import Badge from './ui/Badge';
import { Card, CardContent } from './ui/Card';
import PageHeader from './ui/PageHeader';

function EnConstruccion({ titulo, descripcion, Icono, proximo }) {
  return (
    <section className="space-y-6">
      <PageHeader
        title={titulo}
        description={descripcion}
        actions={
          <Badge variant="warning" dot>
            En construcción
          </Badge>
        }
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center sm:py-16">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <Icono className="size-7" aria-hidden="true" />
          </span>

          <div className="max-w-lg space-y-2">
            <h2 className="text-xl font-semibold text-neutral-900">
              Estamos preparando este módulo
            </h2>
            <p className="text-sm text-neutral-600 sm:text-base">
              La navegación, el diseño y la sesión ya están listos. Las funciones de
              esta sección se habilitarán en una próxima entrega.
            </p>
          </div>

          {proximo ? (
            <Badge variant="neutral" size="sm">
              {proximo}
            </Badge>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

export default EnConstruccion;
