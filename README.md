# DentAssist
Dental practice management support system

## API de citas

La plataforma web es de uso exclusivo del **personal de la clínica** (`admin` o `recepcionista`).
Los pacientes gestionan sus citas y solicitudes por WhatsApp.

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
- **No se permiten cruces de horario**: ni el profesional ni el paciente pueden tener dos citas solapadas el mismo día.
- Las citas en estado `cancelada` o `no_asistio` no ocupan horario.
- Citas contiguas (por ejemplo 10:00–10:30 y 10:30) no se consideran cruce.

### Códigos de respuesta

| Código | Significado |
| --- | --- |
| `200` | Operación exitosa |
| `201` | Cita creada |
| `400` | Datos inválidos |
| `401` | Token ausente o inválido |
| `403` | El usuario no es personal de la clínica |
| `404` | La cita o una referencia (paciente, profesional, servicio) no existe |
| `409` | Cruce de horario |

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
