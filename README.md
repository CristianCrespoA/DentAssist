# DentAssist
Dental practice management support system

## API de citas

La plataforma web es de uso exclusivo del **personal de la clínica** (`admin` o `recepcionista`).
Los pacientes gestionan sus citas y solicitudes por WhatsApp.

La aplicación web vive en [`frontend/`](frontend/README.md) (React + Vite + Tailwind CSS). Incluye el
sistema de diseño, el app shell responsive, las rutas protegidas, el cliente API compartido, el
CRUD de pacientes, la agenda por día y por todas las fechas, el formulario de crear/editar citas
con disponibilidad en vivo y la bandeja de solicitudes por estado con su historial y acciones.

El backend también expone el **canal de WhatsApp** (webhook de Meta, persistencia de
conversaciones y mensajes, aviso de privacidad, menú interactivo, reserva de citas y simulador
local). Ver [`Canal de WhatsApp`](#canal-de-whatsapp) y
[`Ejecución local`](#ejecución-local-y-prueba-en-otra-máquina).

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

### Interfaz web de solicitudes

La ruta `/solicitudes` del frontend opera esta API:

- **Pestañas y contadores:** «Pendientes», «En atención», «Resueltas» y «Todas» con el total de cada estado. Los contadores se calculan con cuatro peticiones de `limite=1` al listado, reutilizando los filtros activos.
- **Filtros y URL:** tipo, fecha de recepción y paciente (búsqueda remota) con paginación de 10 por página. El estado se guarda en `?estado=&tipo=&fecha=&pacienteId=&pagina=&solicitud=` para conservar pestaña, filtros, página y detalle al refrescar o compartir; los valores inválidos se descartan con `replace`.
- **Listado:** fecha y hora de recepción en `America/Bogota`, paciente, tipo, resumen del mensaje, estado como badge y acciones. La fila abre el detalle y el botón de acción rápida toma la solicitud en atención.
- **Detalle e historial:** modal con los datos del paciente, el mensaje original, la cita vinculada (con enlace a `/agenda?fecha=…`), la propuesta de fecha/hora si es reprogramación y la línea de tiempo del historial con usuario y comentario. El detalle permanece abierto tras cada acción.
- **Acciones:** «Tomar en atención» y «Resolver»; resolver exige un `ConfirmDialog` con comentario obligatorio y vista previa del efecto (cancelar o mover la cita). Cada acción refresca la lista y los contadores, y muestra un toast.
- **Errores:** un `409` de franja ocupada se muestra dentro del diálogo con las horas libres del día (`alternativas`) y un enlace a la agenda para elegir otro horario; ni la cita ni la solicitud se modifican. Los `400`, `404` y errores de red se explican sin cerrar el detalle.

El contexto de conversación (transcripción) llegará con el modelo de conversaciones del PR 10; en este PR el detalle muestra el `mensaje` guardado en la solicitud.

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
- Los pacientes creados automáticamente desde WhatsApp pueden tener `apellido` vacío y `origen = whatsapp`; el personal lo completa después. Los pacientes creados desde la web usan `origen = web`.
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

## Canal de WhatsApp

Integración con la **WhatsApp Cloud API** de Meta para recibir mensajes, persistir la conversación y responder. Incluye el canal base (webhook, modelos, envío, privacidad y simulador) y el flujo conversacional con menú interactivo y reserva de citas sin intervención humana.

### Variables de entorno

Se configuran únicamente en `backend/.env`; **nunca** deben llegar al frontend ni a una variable de Vite.

| Variable | Descripción |
| --- | --- |
| `WHATSAPP_TOKEN` | Token de acceso de la app de Meta. Los tokens de prueba caducan (~24 h). |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de prueba. |
| `WHATSAPP_VERIFY_TOKEN` | Texto secreto que se escribe al configurar el webhook en Meta. |
| `WHATSAPP_APP_SECRET` | App Secret de Meta; se usa para validar `X-Hub-Signature-256`. |
| `WHATSAPP_API_VERSION` | Versión de Graph API. Por defecto `v23.0`. |
| `WHATSAPP_SIMULADOR` | `1` habilita el simulador en producción. En desarrollo/pruebas está activo por defecto. |

Si faltan `WHATSAPP_TOKEN` o `WHATSAPP_PHONE_NUMBER_ID`, el envío falla de forma segura y el mensaje saliente queda como `fallido`. Si falta `WHATSAPP_APP_SECRET`, el webhook responde `503`.

### Alta del canal en Meta (modo prueba)

1. Crear una app en [Meta for Developers](https://developers.facebook.com/apps) de tipo **Business** y agregar el producto **WhatsApp**.
2. En **WhatsApp → API Setup**, copiar el **Phone number ID** del número de prueba y el **WhatsApp Business Account ID**.
3. En el selector **To**, agregar y verificar hasta 5 números destinatarios de prueba.
4. Generar el **token temporal** (caduca en ~24 h) y guardarlo en `WHATSAPP_TOKEN`.
5. En **App settings → Basic**, copiar el **App Secret** en `WHATSAPP_APP_SECRET`.
6. Definir un texto secreto propio en `WHATSAPP_VERIFY_TOKEN` y reiniciar el backend.
7. Exponer el backend por HTTPS (por ejemplo `ngrok http 3000`) y, en **WhatsApp → Configuration → Webhook**, usar `https://TU-DOMINIO/api/whatsapp/webhook` con el mismo verify token. Verificar y guardar, y suscribirse al campo **messages**.
8. Enviar un mensaje desde un número verificado al número de prueba. El backend debe crear la conversación y el paciente, guardar el entrante, responder el aviso de privacidad y guardar el saliente.

> **El botón «Prueba» del webhook no valida la suscripción.** Meta inyecta ese evento de ejemplo sin pasar por la suscripción, así que funciona aunque el campo `messages` no esté marcado; los mensajes reales, en cambio, nunca llegan. Para confirmarlo:
>
> ```bash
> curl -s "https://graph.facebook.com/v23.0/APP_ID/subscriptions?fields=object,active,fields&access_token=APP_ID|APP_SECRET"
> ```
>
> La respuesta debe incluir `"fields": [{ "name": "messages" }]`. Si `fields` no aparece, suscríbelo con `POST /APP_ID/subscriptions` (`object=whatsapp_business_account`, `callback_url`, `verify_token`, `fields=messages`) o marcando **messages** en el panel y guardando.
>
> Además, el evento real solo se entrega si la cuenta de WhatsApp Business está suscrita a la app (`GET /WABA_ID/subscribed_apps`).

Para producción se necesita un número propio, verificación del negocio, token permanente de un usuario del sistema, método de pago, plantillas aprobadas y una URL HTTPS estable.

### Límites del sandbox de Meta

- La **ventana de servicio es de 24 horas** desde el último mensaje del paciente. Dentro de ella se puede responder con texto libre.
- Fuera de la ventana solo se pueden enviar **plantillas aprobadas** por Meta. Las plantillas no se implementan en este PR: el saliente se guarda como `fallido`, con `requierePlantilla = true` y el motivo correspondiente.
- El número de prueba solo puede escribir a **destinatarios verificados** (hasta 5 en la configuración de prueba).
- El token temporal de prueba caduca aproximadamente cada 24 horas; para producción se usa un token permanente de usuario del sistema.
- Meta reintenta el webhook si la respuesta tarda o falla. Por eso el `POST` responde `200` de inmediato y la idempotencia se controla con `waMessageId`.

### Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/whatsapp/webhook` | Verificación de Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| `POST` | `/api/whatsapp/webhook` | Recepción de mensajes y estados, firmada por Meta |
| `POST` | `/api/whatsapp/simular` | Inyecta un mensaje local por el mismo pipeline |

Los dos endpoints del webhook son públicos porque Meta no envía JWT; se autentican con el verify token y la firma HMAC. El simulador no requiere autenticación, pero solo existe fuera de producción o con `WHATSAPP_SIMULADOR=1`.

#### Verificación

```
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=12345
```

- Token y modo correctos: `200` con el challenge en texto plano.
- Token o modo incorrectos: `403`.

#### Recepción

```
POST /api/whatsapp/webhook
X-Hub-Signature-256: sha256=<hmac>
Content-Type: application/json
```

- La firma se calcula con HMAC SHA-256 sobre el **cuerpo crudo** y se compara en tiempo constante.
- Firma ausente o inválida: `403`. Sin App Secret configurado: `503`.
- Firma válida: `200 { "recibido": true }` inmediato; el evento se procesa después con `setImmediate`.
- Solo se procesan eventos de `whatsapp_business_account`; los mensajes y los estados se recorren por separado.
- Un `waMessageId` ya guardado se ignora: no crea conversación, mensaje ni respuesta nueva.
- Estados `sent`, `delivered`, `read` y `failed` actualizan el mensaje saliente. Los eventos desordenados no hacen retroceder el estado.

#### Flujo conversacional (menú y reserva)

El primer mensaje entrega el aviso de privacidad y, si se envió, el menú. El paso actual se guarda en `Conversacions.estadoFlujo` y los datos parciales en `contexto` (JSON), así que **reiniciar el backend no pierde la conversación**.

El menú usa una lista de 6 filas: Servicios y horarios, Disponibilidad, Solicitar cita, Cancelar cita, Reprogramar y Hablar con una persona. Se respetan los límites de la API: máximo 10 filas por lista y 3 botones por mensaje; la disponibilidad muestra hasta 8 franjas por día.

| Estado | Qué hace |
| --- | --- |
| `inicial` / `aviso_enviado` | Espera el primer mensaje y muestra el menú |
| `menu` | Interpreta la opción elegida |
| `info_servicios` | Catálogo con duración, precio y horario de atención |
| `solicitar_servicio` | Elige servicio del catálogo |
| `solicitar_profesional` | Elige profesional o «Cualquiera disponible» |
| `solicitar_fecha` | Elige día con botones de los próximos días con cupo o escribe `AAAA-MM-DD` |
| `solicitar_hora` | Elige una de las hasta 8 franjas ofrecidas |
| `confirmar` | Muestra el resumen y espera «Sí, agendar» |
| `disponibilidad` | Consulta cupos sin reservar; al terminar vuelve al menú |
| `humano` | Recepción toma la conversación; solo `menú` reactiva el asistente |

Reglas del flujo:

- «Cualquiera disponible» combina las franjas de todos los profesionales activos y recuerda cuál atiende cada una.
- La disponibilidad descarta las citas del propio paciente para no ofrecer un cupo que luego `citaService` rechazaría.
- La cita se crea con `citaService.crearCita` (mismas validaciones y control de cruces) en estado `programada`.
- Si la franja se ocupó entre la oferta y la confirmación, `crearCita` responde `409`, no se crea la cita y se ofrecen las franjas restantes o los siguientes días con cupo.
- Doble confirmación: al agendar, el estado vuelve a `menu` y se guarda la huella del último intento en `contexto.ultimaConfirmacion` durante 5 minutos; un reintento no crea una segunda cita.
- Opción inválida: repite el paso con «No entendí esa opción» sin perder lo ya elegido.
- Atajos de texto en cualquier paso: `menú` (también `hola`, `inicio`, `volver`), `cancelar`/`salir` (cancela la reserva en curso) y `persona`/`asesor`/`recepcion` (deriva a recepción).
- Cancelar y reprogramar del menú derivan a recepción en este PR: así el cupo se libera o se mueve con intervención humana.
- Si ocurre un error interno, se registra el fallo, la conversación pasa a `humano` y el paciente recibe una disculpa con la opción de volver al menú.
- Cada salida se persiste en `Mensajes` con su `payload` interactivo. Los textos se recortan a los límites de Meta (cuerpo 1024, título de botón 20, título de fila 24, descripción 72).

#### Simulador local

```bash
curl -X POST http://localhost:3000/api/whatsapp/simular \
  -H "Content-Type: application/json" \
  -d '{"telefono":"3001234567","texto":"Hola, quiero una cita"}'
```

También acepta `{"telefono":"3001234567","boton":"Agendar cita"}` y `seleccion`, que simula la pulsación de un botón o fila usando su id:

```bash
# Abrir el menú (si aún no hay consentimiento, primero envía el aviso)
curl -X POST http://localhost:3000/api/whatsapp/simular \
  -H "Content-Type: application/json" \
  -d '{"telefono":"3001234567","seleccion":"menu:solicitar"}'
```

Ids que entiende el flujo: `menu:servicios`, `menu:disponibilidad`, `menu:solicitar`, `menu:cancelar`, `menu:reprogramar`, `menu:humano`, `menu:volver`, `serv:<id>`, `prof:<id>`, `prof:cualquiera`, `fecha:AAAA-MM-DD`, `hora:HH:MM`, `hora:otro`, `confirmar:si` y `confirmar:no`.

La respuesta incluye el `conversacionId`, el `mensajeId`, el `estadoFlujo` resultante y las respuestas generadas:

```json
{
  "conversacionId": 1,
  "mensajeId": 7,
  "duplicado": false,
  "estadoFlujo": "solicitar_servicio",
  "respuestas": [
    {
      "id": 8,
      "direccion": "saliente",
      "tipo": "interactivo",
      "contenido": "¿Qué servicio te interesa?\n1. Limpieza dental — 30 min · $ 120.000",
      "payload": {
        "tipo": "interactivo",
        "interactivo": {
          "type": "list",
          "body": { "text": "¿Qué servicio te interesa?" },
          "action": {
            "button": "Ver servicios",
            "sections": [
              {
                "title": "Servicios",
                "rows": [
                  { "id": "serv:1", "title": "Limpieza dental", "description": "30 min · $ 120.000" }
                ]
              }
            ]
          }
        }
      },
      "estado": "enviado",
      "requierePlantilla": false,
      "motivo": null
    }
  ]
}
```

El simulador no llama a Meta: genera identificadores `simulado-*`, usa el mismo pipeline y permite probar el flujo sin credenciales.

#### Inspección de conversaciones

Todavía no hay endpoint de listado. Para revisar lo último que entró y salió, con un script de solo lectura:

```bash
cd backend
npm run whatsapp:verificar            # últimas 10 conversaciones
npm run whatsapp:verificar -- 573001234567
```

Muestra cada mensaje con su dirección, estado, `waMessageId`, `motivoFallo` y `requierePlantilla`. Si no hay conversaciones, el webhook no ha procesado nada.

### Datos y estados

- `Conversacions`: `telefono` único normalizado a dígitos, `pacienteId` opcional, `estadoFlujo`, `contexto` JSON, `ultimaActividad` y `consentimientoAceptadoEn`. El `contexto` guarda la reserva en curso (`servicioId`, `servicioNombre`, `duracionMinutos`, `profesionalId`, `profesionalNombre`, `fecha`, `hora`, `modo`), las opciones vigentes (`opciones`, `franjasOfertadas`, `diasOfrecidos`) y el resultado del último agendamiento (`ultimaCita`, `ultimaConfirmacion`).
- `Mensajes`: `conversacionId`, `waMessageId` único, `direccion` (`entrante`/`saliente`), `tipo`, `contenido`, `payload` JSON, `estado`, `ocurridoEn`, `estadoActualizadoEn`, `motivoFallo` y `requierePlantilla`. Tiene índice por conversación y fecha. En los salientes interactivos, `contenido` guarda la versión de texto plano y `payload` el objeto enviado a Meta.
- `Pacientes`: se agrega `origen` (`web`, `whatsapp`, `manual`) y `telefonoNormalizado` único.

| Estado | Significado |
| --- | --- |
| `recibido` | Mensaje entrante guardado |
| `enviado` | Meta aceptó el saliente |
| `entregado` | Meta lo entregó al dispositivo |
| `leido` | El paciente lo abrió |
| `fallido` | No se pudo enviar o la entrega falló; el motivo queda sin datos sensibles |

### Privacidad (Ley 1581)

- En el primer mensaje de cada conversación se envía el aviso de tratamiento de datos. La aceptación es implícita al continuar la conversación y se guarda en `consentimientoAceptadoEn` solo si el aviso se envió correctamente.
- Los logs usan únicamente eventos e identificadores internos (`conversacionId`, `mensajeId`, `pacienteId`), nunca teléfono, nombre, contenido ni payload.
- Si llega un audio, imagen, video, documento, sticker, ubicación u otro tipo no soportado, se responde con un texto que indica que por ahora la atención es por texto o botones. El mensaje original se conserva en `payload`.

### Riesgo de procesamiento en memoria

El webhook responde `200` y procesa el evento con `setImmediate` dentro del mismo proceso. Si el proceso se reinicia justo después de responder, el evento ya confirmado a Meta puede perderse. Para producción se recomienda mover el procesamiento a una cola persistente (por ejemplo BullMQ/Redis o una tabla de eventos pendientes) con reintentos e idempotencia.

## Ejecución local y prueba en otra máquina

Todo el proyecto se puede ejecutar **sin servicios en la nube y sin costo**: MySQL/MariaDB local,
backend y frontend en `localhost`, y el canal de WhatsApp con el **simulador** (no llama a Meta).

### Requisitos

- Node.js 18 o superior (probado con Node 24) y `npm`.
- MySQL 8 o MariaDB (por ejemplo, el de XAMPP) escuchando en `127.0.0.1:3306`.
- Git.

### 1. Base de datos

Crea una base vacía con `utf8mb4` (desde phpMyAdmin o la consola de MySQL):

```sql
CREATE DATABASE nodestore CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 2. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edita `backend/.env` con tus datos locales. Para el simulador no hace falta ninguna credencial de
Meta; deja vacías las variables `WHATSAPP_*`:

```ini
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=nodestore
DB_PORT=3306
PORT=3000
SLOT_MINUTOS=30
JWT_SECRET=cambia_esta_clave
JWT_EXPIRES_IN=1d
WHATSAPP_SIMULADOR=0
```

Aplica el esquema y los datos de demostración (solo la primera vez):

```powershell
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

Levanta el backend:

```powershell
npm run dev        # recarga automática con nodemon
# o: npm start     # sin recarga
```

Debe imprimir `Conectado a MySQL con Sequelize` y `Servidor corriendo en http://localhost:3000`.
Las migraciones crean las tablas del canal de WhatsApp (`Conversacions` y `Mensajes`); el seed crea
el usuario `admin@dentassist.com` / `admin123`, profesionales, servicios, horarios y pacientes.

### 3. Frontend

En otra terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con `admin@dentassist.com` / `admin123`. El frontend
usa `VITE_API_URL=http://localhost:3000/api`.

### 4. Probar el flujo de WhatsApp sin Meta (gratis)

Con el backend arriba, usa el simulador. Cada llamada es un mensaje entrante y la respuesta incluye
el `estadoFlujo` y las salidas persistidas:

```powershell
$base = 'http://localhost:3000/api/whatsapp/simular'
$tel = '3001234567'

# Primer contacto: aviso de privacidad + menú
Invoke-RestMethod -Method Post -Uri $base -ContentType 'application/json' `
  -Body (@{ telefono = $tel; texto = 'Hola' } | ConvertTo-Json)

# Pulsar una opción por su id
Invoke-RestMethod -Method Post -Uri $base -ContentType 'application/json' `
  -Body (@{ telefono = $tel; seleccion = 'menu:solicitar' } | ConvertTo-Json)
```

Repite con los ids que devuelve cada paso (`serv:1`, `prof:cualquiera`, `fecha:2026-10-30`,
`hora:08:00`, `confirmar:si`). Al confirmar, la cita queda creada en `Citas` con estado
`programada`. Para verificar la conversación:

```powershell
cd backend
npm run whatsapp:verificar -- 573001234567
```

Puedes detener el backend a mitad del flujo y volver a levantarlo: el paso se conserva en la base y
la conversación continúa donde iba.

### 5. Probar en otra máquina

1. Clona el repositorio y repite los pasos 1 a 3 (cada máquina usa su propio MySQL local).
2. Ejecuta la suite desde `backend/`: `npm test` (debe quedar todo en verde).
3. Usa un teléfono nuevo en el simulador para empezar una conversación desde cero.
4. Opcional, para probar con WhatsApp real y sin costo: usa el **número de prueba** de Meta y un
   túnel gratuito (por ejemplo `ngrok http 3000`). Configura el webhook en
   `https://<tu-tunel>/api/whatsapp/webhook`, suscríbelo a `messages` y escribe desde un número
   autorizado en la app de Meta. El token de prueba caduca en ~24 h y fuera de la ventana de 24 h
   solo se pueden enviar plantillas aprobadas.

No se necesita tarjeta ni suscripción: MySQL local y el simulador cubren todo el flujo. La única
dependencia externa opcional es el sandbox gratuito de Meta para la prueba con WhatsApp real.

## Pruebas

Desde `backend/`:

```bash
npm test
```

La suite usa el runner integrado de Node y cubre la conversión de horas, el cálculo del día de la semana, la generación de bloques para servicios de 30, 45 y 60 minutos, el receso de almuerzo, el cierre, los bloqueos por citas, los cupos ya transcurridos del día y la validación de horario de las citas. Las pruebas de citas cubren crear y editar con y sin cruce, el día cerrado, la agenda llena, eliminar una cita cancelada, el rechazo `409` al eliminar una cita programada y el `404` de una cita inexistente. Las pruebas de solicitudes cubren las transiciones permitidas y prohibidas, el comentario obligatorio, el historial con usuario, los efectos de cancelación y reprogramación, el rollback ante un cruce con alternativas, los filtros y la paginación, los permisos de staff y la migración con datos previos y su `down`. Las pruebas de WhatsApp cubren la verificación del webhook, la firma HMAC, la idempotencia por `waMessageId`, la creación y reutilización del paciente, el aviso y consentimiento, los estados `sent`/`delivered`/`read`/`failed`, los tipos no soportados, la ventana de 24 h, los reintentos del envío, el simulador, los logs sin datos personales y la migración del canal. Las transcripciones del flujo cubren el camino feliz de reserva, la doble confirmación, los días sin cupo, la disponibilidad, las opciones inválidas, el reinicio a mitad del flujo, el conflicto `409`, los atajos, los servicios y horarios, los límites de WhatsApp y el estado `humano`.
