# DentAssist

Sistema de gestión para consultorios odontológicos con integración a WhatsApp.

## Tecnologías
- **Backend:** Node.js, Express, Sequelize, MySQL
- **Frontend:** React, Vite, Tailwind CSS
- **Integración:** WhatsApp Cloud API (Meta)

## Funcionalidades
- **Pacientes:** Registro, búsqueda, edición y control de duplicados.
- **Agenda:** Gestión de citas por día/todas las fechas, validación de horarios, cruces y disponibilidad en tiempo real.
- **Citas:** Creación, edición, cancelación, estados y reglas de eliminación.
- **Solicitudes WhatsApp:** Bandeja con estados, historial, resolución y efectos (cancelar/reprogramar citas).
- **Catálogo:** Profesionales y servicios con filtros.
- **Horarios:** Configuración por día con recesos.
- **Canal WhatsApp:** Menú interactivo, reserva de citas, simulador local y flujo conversacional.
- **Seguridad:** Roles (admin/recepcionista), autenticación JWT y control de permisos.

## Requisitos
- [Node.js](https://nodejs.org/) LTS 22.x
- [MySQL](https://www.mysql.com/) 8.x o [MariaDB](https://mariadb.org/) 10.6+
- [npm](https://www.npmjs.com/)

## Estructura
```text
DentAssist/
├── backend/   # API REST, migraciones, seeders y canal WhatsApp
├── frontend/  # React + Vite + Tailwind CSS
├── docs/      # Colección Postman
└── render.yaml
```

## Instalación local

### 1) Clonar
```bash
git clone <URL_DEL_REPO>
cd DentAssist
```

### 2) Backend
```bash
cd backend
cp .env.example .env
npm ci
```

Configura `backend/.env` con tus credenciales MySQL y JWT.

### 3) Frontend
```bash
cd ../frontend
cp .env.example .env
npm ci
```

Asegura `VITE_API_URL=http://localhost:3000/api` en `frontend/.env`.

## Base de datos
```sql
CREATE DATABASE nodestore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```bash
cd backend
npm run migrate
npm run seed:all
```

**Usuarios demo:** revisar `backend/src/seeders/`. No usar en producción.

## Ejecución
```bash
# Terminal 1
cd backend
npm run dev

# Terminal 2
cd frontend
npm run dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- Health: http://localhost:3000/api/health

## Pruebas
```bash
cd backend
npm test
```

## Documentación
- [Colección Postman](docs/POSTMAN-DENTASSIST.json)
- [README Frontend](frontend/README.md)
