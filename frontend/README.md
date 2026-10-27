# DentAssist — Frontend

Aplicación web para el **personal de la clínica** (`admin` y `recepcionista`). Los
pacientes gestionan sus citas y solicitudes por WhatsApp; esta interfaz no está
pensada para uso de pacientes.

## Requisitos

- Node.js 20.19+ o 22.12+.
- Backend de DentAssist en ejecución (por defecto `http://localhost:3000`).

## Puesta en marcha

```bash
npm install
cp .env.example .env
npm run dev
```

`frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

La app queda disponible en `http://localhost:5173`.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build localmente |
| `npm run lint` | ESLint sobre todo el proyecto |

## Stack

- React 19 + React Router 7 + Vite 8.
- Tailwind CSS v4 mediante `@tailwindcss/vite` (configuración CSS-first, sin
  `tailwind.config.js`).
- Headless UI para diálogos accesibles.
- lucide-react para iconografía.

## Sistema de diseño

Los tokens viven en `src/index.css` dentro de `@theme`:

- **Colores:** `primary`, `success`, `warning`, `danger` y `neutral`.
- **Tipografía:** familia base y escala `text-display`.
- **Radios:** `rounded-field`, `rounded-card`, `rounded-dialog`.
- **Sombras:** `shadow-card`, `shadow-float`.
- **Espaciados:** `spacing-page`, `spacing-sidebar`.

No se usan estilos inline. Las clases condicionales se combinan con `cn` desde
`src/lib/cn.js`.

### Componentes base (`src/components/ui/`)

| Componente | Uso |
| --- | --- |
| `Button` | Variantes `primary`, `secondary`, `ghost`, `danger`, `success`, `link`; tamaños y estado de carga |
| `Input`, `Select`, `Textarea` | Controles con estados de error y foco visibles; `Input` admite adornos al inicio y al final |
| `Field` | Etiqueta, ayuda y error asociados con `id`, `aria-invalid` y `aria-describedby` |
| `Card` | Contenedor con `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` y `CardFooter` |
| `Table` | Tabla en escritorio y tarjetas apiladas en móvil; filas clicables con foco y activación por `Enter`/`Espacio` |
| `Badge` | Estados con variantes de color |
| `Modal` | Diálogo Headless UI con Esc, trampa de foco, `aria-labelledby` y descripción |
| `ConfirmDialog` | Confirmación con foco inicial en «Cancelar» y rol `alertdialog` |
| `EmptyState` | Estado vacío con icono y acción opcional |
| `Spinner` | Indicador de carga con texto para lectores de pantalla |
| `ToastProvider` + `useToast` | Notificaciones accesibles, autocierre y cierre manual |
| `PageHeader` | Título, descripción y acciones de pantalla |

## App shell y rutas

- `/` redirige a `/agenda`.
- `/agenda` es una ruta protegida con la agenda por día y por todas las fechas.
- `/solicitudes` es una ruta protegida con la bandeja de solicitudes por estado.
- `/pacientes` es una ruta protegida con el CRUD completo de pacientes.
- Cualquier ruta desconocida redirige a `/agenda` (sin 404).
- `/login` es pública; si ya hay sesión redirige a `/agenda`.

En escritorio se usa un sidebar fijo. Por debajo de `lg` aparece una barra
superior con menú lateral deslizante. El shell muestra el nombre del usuario, su
rol, la ruta activa y el cierre de sesión.

## Cliente API y sesión

`src/services/api.js` centraliza las peticiones:

- URL desde `VITE_API_URL`.
- `Authorization: Bearer <token>` desde `localStorage`.
- JSON de entrada y salida.
- Errores normalizados con `{ mensaje, status }` (`ApiError`).
- En un `401` se limpia la sesión, se emite `dentassist:sesion-expirada` y se
  redirige al login con un toast informativo.

La sesión se sincroniza entre pestañas mediante el evento `storage`.

## Pacientes

`/pacientes` opera la API del PR 1 (`src/services/pacientes.js`):

- **Listado y búsqueda:** tabla con nombre, teléfono, correo, fecha de nacimiento
  y acciones. El buscador aplica un debounce de 300 ms y consulta nombre,
  apellido, correo y teléfono. La búsqueda vuelve siempre a la página 1.
- **Paginación:** 20 pacientes por página con «Anterior»/«Siguiente», resumen de
  resultados y total. La página y la búsqueda se conservan al abrir, guardar o
  cancelar una edición.
- **Crear y editar:** modal con todos los campos del modelo. La validación del
  cliente replica el backend (obligatorios, longitudes, formato de correo,
  teléfono de 7 a 15 dígitos y fecha no futura) y enfoca el primer campo con
  error. Los `409` y demás errores del servidor se muestran junto al campo
  correspondiente y el formulario permanece abierto.
- **Teléfono:** se muestra con el indicativo `+57`; al editar se oculta el
  prefijo almacenado y el backend lo vuelve a normalizar al guardar.
- **Detalle:** modal con todos los datos, enlaces `tel:`/`mailto:` y dos accesos
  a la agenda: «Ver agenda del día» navega a `/agenda?pacienteId=ID` y «Todas
  sus citas» a `/agenda?vista=todas&pacienteId=ID`, ambos con el paciente
  filtrado.
- **Eliminar:** confirmación con foco inicial en «Cancelar». Si la API responde
  `409` porque el paciente tiene citas o solicitudes, el motivo se explica dentro
  del diálogo y no se cierra.
- **Estados:** carga, vacío, sin coincidencias, error de red con reintento y
  errores `401`/`403`. Las altas, ediciones y eliminaciones exitosas muestran un
  toast; los fallos también se notifican salvo el `409` de eliminación, que queda
  inline para no perder el contexto.

La lógica de formato, validación y traducción de mensajes del backend vive en
`src/lib/pacientes.js`; los componentes de la pantalla están en
`src/components/pacientes/`.

## Agenda

`/agenda` es la pantalla principal del personal y opera el listado de citas del
PR 2 (`src/services/citas.js`):

- **Vistas:** el conmutador «Día» / «Todas las fechas» cambia entre la agenda de
  una fecha y el listado completo agrupado por día, de la más antigua a la más
  reciente. Cambiar de vista conserva paciente, profesional y estado.
- **Fecha:** en la vista por día se usa el día actual en `America/Bogota` por
  defecto. El selector de fecha y los botones «Anterior», «Siguiente» y «Hoy»
  cambian el día consultado.
- **URL como fuente de verdad:** `?fecha=YYYY-MM-DD&pacienteId=&profesionalId=&estado=`
  para la vista por día y `?vista=todas&pacienteId=&profesionalId=&estado=` para
  todas las fechas, mediante `useSearchParams`, para conservar el estado al
  refrescar, compartir enlaces y abrir la agenda desde la ficha de un paciente.
  Una fecha inválida o ausente se normaliza a hoy y los parámetros desconocidos
  se eliminan con `replace`.
- **Filtros:** paciente con combobox de búsqueda remota (debounce de 300 ms,
  navegación con flechas/`Enter`/`Esc` y cierre al hacer clic fuera),
  profesional desde el catálogo (`src/services/profesionales.js`) y estado.
  «Limpiar filtros» solo quita paciente, profesional y estado. Una sola petición
  a `/api/citas` por cambio; en la vista combinada se omite `fecha`.
- **Listado:** ordenado por fecha y hora, con inicio y fin calculados a partir de
  `servicio.duracionMinutos` (30 por defecto), paciente, profesional, servicio,
  badge de estado y observaciones abreviadas. En la vista combinada cada día
  tiene su encabezado con el total de citas. Incluye resumen con total, rango
  horario del día o cantidad de días y conteo por estado.
- **Detalle:** clic, `Enter` o `Espacio` sobre una fila (o tarjeta en móvil) abre
  un panel de solo lectura con los datos completos. «Editar» abre el formulario;
  «Eliminar» solo se muestra si la cita está cancelada y, en el resto, el panel
  explica que primero hay que cambiar su estado a «Cancelada».
- **Crear y editar:** «Nueva cita» y «Editar» abren `CitaFormModal` sobre la
  misma base. El paciente se busca con el combobox reutilizable (sin opción
  «Todos»), el profesional y el servicio salen del catálogo y muestran
  especialidad, duración y precio. El estado solo aparece al editar; las
  observaciones son opcionales y el resumen muestra el rango inicio–fin antes de
  guardar.
- **Disponibilidad:** `src/services/disponibilidad.js` consulta
  `GET /api/disponibilidad` con fecha, profesional y servicio; al cambiar
  cualquiera de ellos se recargan las franjas y se limpia la hora elegida. Sin
  cupos se muestra el motivo y «Ver día siguiente», también para días cerrados.
  Al editar, si la hora original ya no viene en `franjas` pero sigue cabiendo en
  el `horario`, se vuelve a ofrecer; las citas históricas conservan la hora
  registrada sin consultar disponibilidad.
- **Errores del formulario:** un `409` conserva el modal y los valores, marca la
  hora y muestra el rango ocupado del backend; un `400` marca los campos, un
  `404` avisa de una referencia inexistente y un `401` lo maneja el cliente API.
  El botón de guardar se deshabilita con una guardia `guardando` para evitar
  dobles envíos y el foco salta al primer campo con error.
- **Eliminar:** confirmación con paciente, fecha y horario; el motivo de un `409`
  del backend se muestra dentro del diálogo. Tras guardar o eliminar se
  refresca el listado conservando vista y filtros de la URL y se muestra un
  toast.
- **Estados:** carga, vacío («no hay citas para esta fecha», «sin citas con
  estos filtros» o «no hay citas registradas»), error de red con reintento y sin
  datos de otra fecha. Cuando hay un paciente filtrado sin citas ese día, el
  vacío ofrece «Ver todas las fechas».

La lógica de fechas, agrupación, estados, rangos y resumen vive en
`src/lib/agenda.js`; la de validación, payload, errores y horario del formulario
en `src/lib/citas.js`. Los componentes están en `src/components/agenda/` y los
servicios de catálogo y disponibilidad en `src/services/servicios.js`,
`src/services/profesionales.js` y `src/services/disponibilidad.js`.

## Solicitudes

`/solicitudes` opera la API del PR 8 (`src/services/solicitudes.js`) y cierra el
ciclo de lo que llega por WhatsApp:

- **Pestañas y contadores:** «Pendientes», «En atención», «Resueltas» y «Todas»,
  con el total de cada estado. Son un `tablist` accesible: flechas izquierda y
  derecha para moverse, `Home`/`End` para ir al primero o al último, y el
  contador anuncia su valor con `aria-label`. Los totales se calculan con cuatro
  peticiones de `limite=1` al listado (`contarSolicitudes`), reutilizando los
  filtros activos y sin endpoint adicional.
- **URL como fuente de verdad:** `?estado=&tipo=&fecha=&pacienteId=&pagina=&solicitud=`
  mediante `useSearchParams`; refrescar o compartir el enlace conserva pestaña,
  filtros, página y detalle abierto. Los valores inválidos y los parámetros
  desconocidos se descartan con `replace`, y `pagina` vuelve a la última página
  con resultados si tras resolver queda fuera de rango.
- **Filtros:** tipo, fecha de recepción y paciente con el combobox reutilizable
  de la agenda (búsqueda remota con debounce de 300 ms). «Limpiar filtros» quita
  tipo, fecha y paciente; la pestaña se conserva.
- **Listado:** fecha y hora de recepción en `America/Bogota`, paciente, tipo,
  resumen del mensaje, estado como badge y acciones. La fila abre el detalle con
  clic, `Enter` o `Espacio`; el botón de acción rápida toma la solicitud en
  atención sin salir de la lista. Paginación de 10 por página con resumen
  «desde–hasta de total».
- **Detalle:** modal accesible con los datos de contacto del paciente, el
  mensaje original guardado, el servicio, la cita vinculada (fecha, hora,
  profesional, estado y enlace a `/agenda?fecha=…` con el paciente filtrado) y,
  en reprogramaciones, la fecha y hora propuestas. Incluye la línea de tiempo del
  historial con el cambio de estado, comentario, usuario y fecha.
- **Tomar en atención:** acción directa con toast y refresco de la lista y los
  contadores; la solicitud pasa a la pestaña «En atención».
- **Resolver:** `ConfirmDialog` con comentario obligatorio y vista previa del
  efecto antes de confirmar («la cita se cancelará» o «la cita se moverá» con el
  horario original y el propuesto). El detalle permanece abierto tras resolver y
  muestra el nuevo estado, el historial actualizado y cómo quedó la cita.
- **Errores de negocio:** un `409` de franja ocupada se muestra dentro del mismo
  diálogo con las horas libres de ese día (`datos.alternativas`) y un enlace a la
  agenda para elegir otro horario; ni la cita ni la solicitud se modifican. Un
  `400` (por ejemplo, falta de comentario) o un horario fuera de atención también
  se muestran sin cerrar el detalle. Un `404` al abrir el detalle ofrece
  «Reintentar».
- **Estados:** carga, vacío por pestaña o por filtros (con acción para limpiar o
  ver pendientes), error de red con reintento y aviso si fallan solo los
  contadores. Cada acción exitosa refresca la lista y muestra un toast; los
  fallos de las acciones rápidas se notifican sin perder la vista.

La lógica de estados, tipos, orígenes, formato de fechas y textos del efecto vive
en `src/lib/solicitudes.js`; el detalle y las acciones están en
`src/components/solicitudes/SolicitudDetalleModal.jsx`.

El contexto de conversación (transcripción de WhatsApp) llegará con el modelo de
conversaciones del PR 10; por ahora el detalle muestra el `mensaje` guardado en
la solicitud.


## Calidad

No hay runner de pruebas unitarias en el frontend. Cada cambio se valida con:

```bash
npm run lint
npm run build
```

La agenda se verifica manualmente con backend y MySQL en marcha: crear y editar
con y sin cruce de horario, día cerrado o sin cupos, eliminar una cita cancelada,
intento de eliminar una programada (`409`), doble submit y expiración de sesión
(`401`). La bandeja de solicitudes se verifica llevando una solicitud de
pendiente a resuelta desde la UI, comprobando el historial, la cancelación o el
movimiento de la cita en `/agenda`, el `409` de una reprogramación ocupada con
sus alternativas y que los errores de negocio no cierran el detalle. Las reglas
de negocio de citas, disponibilidad y solicitudes se cubren con `npm test` en
[`../backend/`](../README.md#pruebas).

## Accesibilidad y responsive

- Foco visible en enlaces, botones y controles.
- Skip link «Saltar al contenido» y foco en `<main>` al cambiar de ruta.
- Diálogos con cierre por `Esc`, foco atrapado y fondo marcado como `inert` /
  `aria-hidden` por Headless UI.
- Mensajes de error con `role="alert"`; toasts con `role="status"` o `alert`.
- Objetivos táctiles de al menos 32–40 px y layouts probados a 360, 768 y
  1280 px.
- Las tablas se convierten en tarjetas por debajo del breakpoint `md`.
- Las filas clicables de la agenda y de solicitudes son enfocables y se activan
  con `Enter` o `Espacio`; el conmutador de vista de la agenda anuncia su estado
  con `aria-pressed`, la bandeja de solicitudes usa un `tablist` con navegación
  por flechas y `Home`/`End`, el selector de paciente anuncia su valor actual y
  los encabezados de columna solo visuales conservan su nombre accesible.
- Se respeta `prefers-reduced-motion`.
