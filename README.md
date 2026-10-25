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
