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
| `Input`, `Select`, `Textarea` | Controles con estados de error y foco visibles |
| `Field` | Etiqueta, ayuda y error asociados con `id`, `aria-invalid` y `aria-describedby` |
| `Card` | Contenedor con `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` y `CardFooter` |
| `Table` | Tabla en escritorio y tarjetas apiladas en móvil |
| `Badge` | Estados con variantes de color |
| `Modal` | Diálogo Headless UI con Esc, trampa de foco, `aria-labelledby` y descripción |
| `ConfirmDialog` | Confirmación con foco inicial en «Cancelar» y rol `alertdialog` |
| `EmptyState` | Estado vacío con icono y acción opcional |
| `Spinner` | Indicador de carga con texto para lectores de pantalla |
| `ToastProvider` + `useToast` | Notificaciones accesibles, autocierre y cierre manual |
| `PageHeader` | Título, descripción y acciones de pantalla |

## App shell y rutas

- `/` redirige a `/agenda`.
- `/agenda`, `/pacientes` y `/solicitudes` son rutas protegidas. Hasta los PRs 5,
  6 y 9 muestran una página provisional «en construcción».
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

## Accesibilidad y responsive

- Foco visible en enlaces, botones y controles.
- Skip link «Saltar al contenido» y foco en `<main>` al cambiar de ruta.
- Diálogos con cierre por `Esc`, foco atrapado y fondo marcado como `inert` /
  `aria-hidden` por Headless UI.
- Mensajes de error con `role="alert"`; toasts con `role="status"` o `alert`.
- Objetivos táctiles de al menos 32–40 px y layouts probados a 360, 768 y
  1280 px.
- Las tablas se convierten en tarjetas por debajo del breakpoint `md`.
- Se respeta `prefers-reduced-motion`.
