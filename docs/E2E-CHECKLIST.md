# Checklist E2E DentAssist

## Auth
- [ ] Login con admin correcto
- [ ] Login con recepcionista correcto
- [ ] Paciente rechazado con 403 (según reglas)
- [ ] Token inválido -> 401
- [ ] Token expirado -> 401

## Pacientes
- [ ] Crear paciente
- [ ] Editar paciente
- [ ] Buscar/filtrar
- [ ] Evitar duplicados
- [ ] No borrar paciente con citas/historial crítico

## Agenda
- [ ] Ver por fecha
- [ ] Navegar días
- [ ] Filtrar por profesional/estado/paciente
- [ ] Abrir cita desde enlace con query

## Citas
- [ ] Crear con disponibilidad válida
- [ ] Cruce profesional -> 409
- [ ] Cruce paciente -> 409
- [ ] Citas contiguas permitidas
- [ ] Editar cita
- [ ] Cancelar cita
- [ ] Eliminar solo si estado `cancelada`

## Disponibilidad
- [ ] Día sin horario -> sin cupos
- [ ] Día lleno
- [ ] Servicio 60 min
- [ ] Almuerzo respeta receso

## Solicitudes
- [ ] Listado y filtros
- [ ] Tomar en atención
- [ ] Resolver cancelación (cancela cita)
- [ ] Resolver reprogramación (mueve cita)
- [ ] Conflicto al reprogramar -> 409 con alternativas
- [ ] Historial visible
- [ ] Si origen WhatsApp y ventana abierta -> avisa por WhatsApp
- [ ] Si ventana cerrada -> queda constancia (requiere plantilla)
- [ ] Fallo aviso no revierte resolución

## WhatsApp
- [ ] Menú con lista/botones
- [ ] Info servicios/horarios
- [ ] Disponibilidad
- [ ] Solicitar cita (flujo completo)
- [ ] Cancelar cita -> crea solicitud pendiente (cita sigue activa)
- [ ] Reprogramar -> crea solicitud con propuesta (cita sigue activa)
- [ ] Texto libre / "hablar con persona" -> escalamiento
- [ ] Agrupación < 10 min en misma solicitud
- [ ] Idempotencia por waMessageId
- [ ] Aviso de privacidad
- [ ] Simulador funciona sin credenciales
- [ ] Webhook con firma válida / inválida

## UI/UX
- [ ] Responsive móvil/tablet/desktop
- [ ] Estados vacío/carga/error
- [ ] Navegación clara

## Seguridad/Logs
- [ ] Sin datos sensibles en logs
- [ ] CORS solo dominios permitidos
- [ ] HTTPS en prod
- [ ] Variables solo en backend

## Evidencia
- [ ] URLs: Frontend: ___________  Backend: ___________  Health: ___________/api/health
- [ ] Webhook verificado en Meta
- [ ] Pruebas con simulador y/o número real
- [ ] Screenshots / grabación corta
