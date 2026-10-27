# DentAssist
Dental practice management support system

## API de citas

La plataforma web es de uso exclusivo del **personal de la clínica** (`admin` o `recepcionista`).
Los pacientes gestionan sus citas y solicitudes por WhatsApp.

La aplicación web vive en [`frontend/`](frontend/README.md) (React + Vite + Tailwind CSS). Incluye el
sistema de diseño, el app shell responsive, las rutas protegidas, el cliente API compartido, el
CRUD de pacientes, la agenda por día y por todas las fechas, y el formulario de crear/editar citas
con disponibilidad en vivo.

Todas las rutas requieren el header `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/citas` | Crear una cita |
| `GET` | `/api/citas` | Listar citas con filtros opcionales |
| `PUT` | `/api/citas/:id` | Actualizar una cita (campos parciales) |
| `DELETE` | `/api/citas/:id` | Eliminar una cita |

### Filtros de listado

| Query | Formato | Ejemplo |
| --- | --- | --- |
| `pacienteId` | entero positivo | `/api/citas?pacienteId=1` |
| `profesionalId` | entero positivo | `/api/citas?profesionalId=2` |
| `fecha` | `YYYY-MM-DD` | `/api/citas?fecha=2026-11-10` |
| `estado` | `programada`, `confirmada`, `atendida`, `cancelada`, `no_asistio` | `/api/citas?estado=programada` |

Se pueden combinar, por ejemplo: `/api/citas?pacienteId=1&fecha=2026-11-10&profesionalId=2`.
El listado se devuelve ordenado por fecha y hora ascendente, con paciente, profesional y servicio incluidos.

### Crear cita

```json
{
  "pacienteId": 1,
  "profesionalId": 1,
  "servicioId": 1,
  "fecha": "2026-11-10",
  "hora": "10:00",
  "estado": "programada",
  "solicitudId": null,
  "observaciones": "opcional"
}
```

### Reglas de validación

- Campos obligatorios: `pacienteId`, `profesionalId`, `servicioId`, `fecha` y `hora`.
- `fecha` debe existir en el calendario y usar el formato `YYYY-MM-DD`.
- `hora` acepta `HH:MM` o `HH:MM:SS`.
- La duración se toma de `Servicio.duracionMinutos` (30 minutos si no está definida).
- **La hora debe pertenecer al horario de atención** de la clínica para el día de la cita, estar alineada a bloques de `SLOT_MINUTOS` desde el inicio del rango y dejar que el servicio complete su duración antes del cierre o del receso de almuerzo. En caso contrario la API responde `400`.
- Las citas con fecha anterior a hoy en `America/Bogota` se pueden editar sin exigir el horario actual, para no invalidar registros históricos.
- **No se permiten cruces de horario**: ni el profesional ni el paciente pueden tener dos citas solapadas el mismo día.
- Las citas en estado `cancelada` o `no_asistio` no ocupan horario.
- Citas contiguas (por ejemplo 10:00–10:30 y 10:30) no se consideran cruce.
- **Solo se pueden eliminar citas canceladas.** `DELETE /api/citas/:id` responde `409` con el mensaje
  `Solo se pueden eliminar citas canceladas` para cualquier otro estado, de modo que el historial de
  una cita activa no se borre por accidente. Para eliminarla primero se cambia su estado a
  `cancelada` mediante `PUT /api/citas/:id`.

### Códigos de respuesta

| Código | Significado |
| --- | --- |
| `200` | Operación exitosa |
| `201` | Cita creada |
| `400` | Datos inválidos |
| `401` | Token ausente o inválido |
| `403` | El usuario no es personal de la clínica |
| `404` | La cita o una referencia (paciente, profesional, servicio) no existe |
| `409` | Cruce de horario, o intento de eliminar una cita que no está cancelada |

### Interfaz web de agenda

La ruta `/agenda` del frontend opera el listado de citas:

- **Vistas:** «Día» muestra la agenda de una fecha concreta y «Todas las fechas» muestra todas las citas agrupadas por día, de la más antigua a la más reciente. Cambiar de vista conserva los filtros.
- **Fecha:** en la vista por día se usa el día actual en `America/Bogota` por defecto. El selector de fecha y los botones «Anterior», «Siguiente» y «Hoy» cambian el día consultado.
- **URL como fuente de verdad:** `?fecha=YYYY-MM-DD&pacienteId=&profesionalId=&estado=` para la vista por día y `?vista=todas&pacienteId=&profesionalId=&estado=` para todas las fechas. Un enlace conserva los filtros al refrescar o compartir; una fecha inválida o ausente se normaliza a hoy y los parámetros desconocidos se eliminan con `replace`.
- **Filtros:** paciente con búsqueda remota y debounce de 300 ms, profesional desde el catálogo y estado. «Limpiar filtros» solo quita paciente, profesional y estado.
- **Sin N+1:** cada cambio de vista, fecha o filtro hace una única petición a `/api/citas` (sin `fecha` en la vista combinada). El catálogo de profesionales se carga una vez y el paciente del filtro se resuelve con `GET /api/pacientes/:id`.
- **Listado:** ordenado por fecha y hora, con inicio y fin calculados a partir de `servicio.duracionMinutos` (30 por defecto), paciente, profesional, servicio, estado como badge y observaciones abreviadas.
- **Resumen:** total de citas, rango horario del día o cantidad de días con citas, y conteo por estado.
- **Detalle:** clic o `Enter` sobre una fila abre un panel de solo lectura con los datos completos. «Editar» abre el formulario y «Eliminar» solo aparece en citas canceladas; en el resto se explica que primero hay que cancelarlas.
- **Crear y editar:** el botón «Nueva cita» y la acción «Editar» abren el mismo modal. El paciente se elige con búsqueda remota, el profesional y el servicio salen del catálogo (con duración y precio), y el estado solo se muestra al editar. El resumen muestra fecha y el rango inicio–fin antes de guardar.
- **Disponibilidad:** fecha, hora, profesional y servicio se eligen con `GET /api/disponibilidad`; al cambiar fecha, profesional o servicio se recargan las franjas. Sin cupos se muestra el motivo y «Ver día siguiente»; un día cerrado o sin cupos también ofrece esa salida. Al editar se vuelve a ofrecer la hora actual si sigue cabiendo en el horario, y las citas históricas conservan la hora registrada sin consultar disponibilidad.
- **Errores del formulario:** un `409` mantiene el modal abierto con el rango ocupado (`El profesional ya tiene una cita…`) y conserva los valores; un `400` marca los campos, un `404` avisa de una referencia inexistente y un `401` cierra sesión a través del cliente API. El botón de guardar se bloquea mientras hay una petición en curso para evitar dobles envíos.
- **Eliminar:** solo disponible para citas canceladas, tras confirmar paciente, fecha y horario. Si el backend rechaza la operación (`409`), el motivo se muestra dentro del diálogo. Tras guardar o eliminar se refresca la agenda conservando la vista y los filtros de la URL, y se muestra un toast.
- **Estados:** carga, vacío («no hay citas para esta fecha», «sin citas con estos filtros» o «no hay citas registradas»), error con reintento y tabla en escritorio con tarjetas en móvil. Si un paciente filtrado no tiene citas ese día, el vacío ofrece «Ver todas las fechas».

## API de solicitudes

Todas las rutas requieren el header `Authorization: Bearer <token>` y están disponibles solo para `admin` y `recepcionista`. Las solicitudes no se eliminan: se conservan para trazabilidad junto con su historial inmutable.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/solicitudes` | Listar solicitudes con filtros y paginación |
| `GET` | `/api/solicitudes/:id` | Obtener el detalle con paciente, cita e historial |
| `PUT` | `/api/solicitudes/:id/estado` | Cambiar el estado y registrar el historial |

### Estados y transiciones

| Estado | Significado |
| --- | --- |
| `pendiente` | Recibida y aún sin atender |
| `en_atencion` | El personal la está gestionando |
| `resuelta` | Cerrada; ya no admite más cambios |

Las únicas transiciones válidas son:

- `pendiente` → `en_atencion`
- `pendiente` → `resuelta`
- `en_atencion` → `resuelta`

Cualquier otra transición, un estado desconocido o intentar resolver dos veces responde `409`. Resolver una solicitud exige `comentario`; si falta, la API responde `400`. Cada transición exitosa crea una fila en `SolicitudHistorials` con fecha/hora (`createdAt`), estado anterior, estado nuevo, usuario autenticado y comentario.

### Listado y filtros

| Query | Formato | Ejemplo |
| --- | --- | --- |
| `estado` | `pendiente`, `en_atencion`, `resuelta` | `/api/solicitudes?estado=pendiente` |
| `tipo` | `cancelacion`, `reprogramacion`, `consulta`, `otra` | `/api/solicitudes?tipo=reprogramacion` |
| `pacienteId` | entero positivo | `/api/solicitudes?pacienteId=1` |
| `fecha` | `YYYY-MM-DD` (día de `fechaSolicitud`) | `/api/solicitudes?fecha=2026-11-10` |
| `pagina` | entero positivo, por defecto `1` | `/api/solicitudes?pagina=2` |
| `limite` | entero entre `1` y `100`, por defecto `20` | `/api/solicitudes?limite=50` |

El resultado se ordena por `fechaSolicitud` descendente y luego por `id` descendente:

```json
{
  "datos": [],
  "total": 0,
  "pagina": 1,
  "limite": 20
}
```

### Detalle

`GET /api/solicitudes/:id` devuelve la solicitud con `paciente`, `servicio`, `cita` (incluido el profesional) e `historial` ordenado de forma ascendente por `createdAt`. Cada fila del historial incluye el `usuario` que hizo el cambio.

### Cambiar estado

```json
{
  "estado": "resuelta",
  "comentario": "El paciente confirmó la cancelación"
}
```

Al resolver, la operación se ejecuta en una transacción y aplica el efecto correspondiente al `tipo`:

- `cancelacion`: la cita vinculada (`citaId`) pasa a `cancelada`, por lo que su horario queda libre.
- `reprogramacion`: se validan la fecha/hora propuestas contra el horario de atención y la misma lógica de cruces de citas. Si la franja está ocupada, no se modifica ni la cita ni la solicitud y la API responde `409` con `alternativas` (horas disponibles en la fecha propuesta). Si está libre, la cita actualiza `fecha` y `hora`.
- `consulta` y `otra`: no modifican citas.

Si la solicitud de reprogramación no tiene `fechaPropuesta`/`horaPropuesta` o no tiene una cita asociada, responde `400`/`409` según el caso.

### Códigos de respuesta

| Código | Significado |
| --- | --- |
| `200` | Listado, detalle o transición exitosa |
| `400` | Filtros o datos inválidos, o falta el comentario al resolver |
| `401` | Token ausente o inválido |
| `403` | Usuario sin rol de personal |
| `404` | La solicitud o una referencia asociada no existe |
| `409` | Transición inválida, resolución repetida, conflicto de horario o falta de cita para reprogramar |

### Migración de datos

La migración `20241025000009-solicitudes-estados-historial.js` amplía temporalmente el ENUM de MySQL, convierte `aprobada` y `rechazada` en `resuelta`, crea una fila de historial por cada fila migrada (con comentario y sin usuario, porque no hay actor original) y deja el ENUM final con `pendiente`, `en_atencion` y `resuelta`. También agrega `tipo` (por defecto `otra`), `citaId`, `fechaPropuesta`, `horaPropuesta` y `origen` (por defecto `whatsapp`), y enlaza las citas existentes que ya apuntaban a una solicitud. El ENUM del historial conserva `aprobada` y `rechazada` para no perder el estado original.

El `down` es explícito: recupera el estado original desde la primera fila de historial cuando existe, usa `pendiente` para `en_atencion` y `aprobada` como equivalencia para una `resuelta` sin historial, y después elimina las columnas nuevas y la tabla de historial.

## API de pacientes

Todas las rutas requieren el header `Authorization: Bearer <token>` y están disponibles solo para `admin` y `recepcionista`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/pacientes` | Crear un paciente |
| `GET` | `/api/pacientes` | Listar/buscar pacientes con paginación |
| `GET` | `/api/pacientes/:id` | Obtener un paciente |
| `PUT` | `/api/pacientes/:id` | Actualizar un paciente (campos parciales) |
| `DELETE` | `/api/pacientes/:id` | Eliminar un paciente sin historial |

### Crear paciente

```json
{
  "nombre": "Laura",
  "apellido": "Gómez",
  "telefono": "+57 300 111 2233",
  "correo": "Laura.Gomez@Example.com",
  "fechaNacimiento": "1992-04-18",
  "direccion": "Calle 45 #12-30, Bogotá"
}
```

### Normalización

- `nombre` y `apellido`: se eliminan espacios al inicio/fin y se colapsan los espacios internos.
- `telefono`: se guardan solo los dígitos, con indicativo y sin `+`. Ejemplo: `+57 300 111 2233` → `573001112233`. Los números colombianos de 10 dígitos (móviles que empiezan por `3` y fijos que empiezan por `60`) se completan automáticamente con el indicativo `57`; también se elimina el prefijo internacional `00`.
- `correo`: se guarda en minúsculas; un valor vacío se interpreta como `null`.
- `direccion`: se recorta y se colapsan los espacios; un valor vacío se interpreta como `null`.

### Reglas de validación

- `nombre` y `apellido` son obligatorios y admiten máximo 100 caracteres.
- `telefono` es obligatorio, debe contener entre 7 y 15 dígitos y no puede repetirse.
- `correo` es opcional, debe tener formato válido, máximo 255 caracteres y no puede repetirse.
- `fechaNacimiento` es opcional, debe usar `YYYY-MM-DD`, existir en el calendario y no ser futura.
- `direccion` es opcional y admite máximo 255 caracteres.
- El teléfono y el correo se comparan después de normalizar; un duplicado responde `409`.

### Listado y búsqueda

| Query | Formato | Ejemplo |
| --- | --- | --- |
| `buscar` | texto libre | `/api/pacientes?buscar=laura` |
| `pagina` | entero positivo, por defecto `1` | `/api/pacientes?pagina=2` |
| `limite` | entero entre `1` y `100`, por defecto `20` | `/api/pacientes?limite=50` |

La búsqueda cubre nombre, apellido, correo y teléfono. La respuesta tiene la forma:

```json
{
  "datos": [],
  "total": 0,
  "pagina": 1,
  "limite": 20
}
```

### Eliminación

Un paciente solo se puede eliminar si no tiene citas ni solicitudes registradas. En caso contrario la API responde `409` e indica qué historial debe cerrarse primero; esto evita que las llaves foráneas en `CASCADE` borren el historial clínico.

### Interfaz web de pacientes

La ruta `/pacientes` del frontend opera esta API:

- Listado paginado (20 por página) con búsqueda por nombre, apellido, correo o teléfono y debounce de 300 ms.
- Alta y edición en un modal con validación en cliente equivalente a la del backend; los errores del servidor se muestran junto al campo y un `409` mantiene el formulario abierto.
- Detalle con todos los datos y acceso directo a la agenda del paciente: «Ver agenda del día» abre `/agenda?pacienteId=ID` y «Todas sus citas» abre `/agenda?vista=todas&pacienteId=ID`, con el filtro aplicado.
- Eliminación con confirmación; si el paciente tiene citas o solicitudes, el `409` se explica dentro del diálogo.
- Estados de carga, vacío, error de red con reintento, `401`/`403` y toasts de éxito o fallo.

## API de catálogo: profesionales y servicios

Catálogo de **solo lectura**. Los profesionales y servicios se administran únicamente por seeders; no se exponen endpoints `POST`, `PUT` ni `DELETE`. Todas las rutas requieren `Authorization: Bearer <token>` y están disponibles solo para `admin` y `recepcionista`.

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/profesionales` | Listar/buscar profesionales |
| `GET` | `/api/profesionales/:id` | Obtener un profesional |
| `GET` | `/api/servicios` | Listar/buscar servicios |
| `GET` | `/api/servicios/:id` | Obtener un servicio |

### Profesionales

Cada profesional se devuelve con `id`, `nombre`, `apellido` y `especialidad`, ordenado alfabéticamente por apellido y nombre.

| Query | Formato | Ejemplo |
| --- | --- | --- |
| `buscar` | texto libre | `/api/profesionales?buscar=ortodoncia` |
| `especialidad` | texto libre (coincidencia parcial) | `/api/profesionales?especialidad=Ortodoncia` |

`buscar` cubre nombre, apellido y especialidad. Se pueden combinar ambos filtros.

### Servicios

Cada servicio se devuelve con `id`, `nombre`, `descripcion`, `duracionMinutos` y `precio`, ordenado alfabéticamente por nombre.

| Query | Formato | Ejemplo |
| --- | --- | --- |
| `buscar` | texto libre | `/api/servicios?buscar=limpieza` |

`buscar` cubre nombre y descripción.

### Respuestas

- `200`: listado o detalle encontrado.
- `400`: parámetro de búsqueda con formato inválido.
- `401`: token ausente o inválido.
- `403`: usuario sin rol de personal.
- `404`: profesional o servicio inexistente.

## Horario de atención y disponibilidad

El horario se define en la tabla `HorariosAtencion`, con varios rangos por día para representar el receso de almuerzo. `diaSemana` usa el estándar `0 = domingo … 6 = sábado`. El seeder de demostración configura:

| Día | Rangos |
| --- | --- |
| Lunes a viernes | `08:00–12:00` y `14:00–18:00` |
| Sábado | `08:00–12:00` |
| Domingo | Cerrado |

El tamaño de los bloques se configura con la variable de entorno `SLOT_MINUTOS` (por defecto `30`). El valor debe ser un entero positivo; cualquier otro valor vuelve a `30`.

### Consultar disponibilidad

```
GET /api/disponibilidad?fecha=2026-11-10&profesionalId=1&servicioId=3
```

Requiere `Authorization: Bearer <token>` y rol `admin` o `recepcionista`.

| Query | Formato | Descripción |
| --- | --- | --- |
| `fecha` | `YYYY-MM-DD` | Día a consultar; no puede ser anterior a hoy en `America/Bogota` |
| `profesionalId` | entero positivo | Profesional que atenderá |
| `servicioId` | entero positivo | Servicio que define la duración |

La respuesta incluye los rangos de atención del día, la duración del servicio y las horas de inicio disponibles:

```json
{
  "fecha": "2026-11-10",
  "cerrado": false,
  "horario": [
    { "inicio": "08:00", "fin": "12:00" },
    { "inicio": "14:00", "fin": "18:00" }
  ],
  "duracionMinutos": 60,
  "franjas": ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]
}
```

Reglas de cálculo:

- Los bloques se generan cada `SLOT_MINUTOS` desde el inicio de cada rango.
- Un bloque solo aparece si el servicio cabe completo dentro de un mismo rango; por eso un servicio de 60 minutos no ofrece `11:30` ni `17:30`.
- Las citas del profesional en estado `programada`, `confirmada` o `atendida` bloquean los bloques que se cruzan con su duración. Las citas `cancelada` y `no_asistio` no bloquean.
- Si la fecha es hoy, se descartan los bloques cuya hora de inicio ya pasó (hora actual en `America/Bogota`).
- Si el día no tiene rangos activos, la respuesta es `200` con `cerrado: true`, `horario: []` y `franjas: []`.
- Si hay horario pero no quedan cupos, la respuesta es `200` con `cerrado: false` y `franjas: []`.

| Código | Significado |
| --- | --- |
| `200` | Disponibilidad calculada (aunque no haya cupos) |
| `400` | Fecha inválida o pasada, o parámetros faltantes/mal formados |
| `401` | Token ausente o inválido |
| `403` | Usuario sin rol de personal |
| `404` | Profesional o servicio inexistente |

## Pruebas

Desde `backend/`:

```bash
npm test
```

La suite usa el runner integrado de Node y cubre la conversión de horas, el cálculo del día de la semana, la generación de bloques para servicios de 30, 45 y 60 minutos, el receso de almuerzo, el cierre, los bloqueos por citas, los cupos ya transcurridos del día y la validación de horario de las citas. Las pruebas de citas cubren crear y editar con y sin cruce, el día cerrado, la agenda llena, eliminar una cita cancelada, el rechazo `409` al eliminar una cita programada y el `404` de una cita inexistente. Las pruebas de solicitudes cubren las transiciones permitidas y prohibidas, el comentario obligatorio, el historial con usuario, los efectos de cancelación y reprogramación, el rollback ante un cruce con alternativas, los filtros y la paginación, los permisos de staff y la migración con datos previos y su `down`.
